import type {
  ComparisonChartPoint,
  ComparisonChartReadModel,
  ComparisonData,
  ComparisonStatsRow,
  ComparisonViewOptions,
  ComparisonViewReadModel,
  ComparisonViewReadModelOptions,
} from '../dtos/comparisonData';
import { evaluateAst, isValidExpression, parseExpression } from './comparisonExpressionService';
import { parseFeatures } from './featureParser';

type ComparisonCase = ComparisonData['results'][number]['cases'][number];

interface SeedData {
  seed: number;
  xValue: number;
  testCase: ComparisonCase;
  inputFeatureValues: string[];
  stderrVars: Record<string, number>;
}

interface ComparisonResultIndex {
  result: ComparisonData['results'][number];
  casesBySeed: Map<number, ComparisonCase>;
  stderrBySeed: Record<number, Record<string, number>>;
}

interface ComparisonDataIndex {
  seeds: number[];
  inputFeatureValuesBySeed: Map<number, string[]>;
  results: ComparisonResultIndex[];
  bestScoreBySeed: Map<number, number>;
  bestScoreCountBySeed: Map<number, number>;
}

type ExpressionEvaluator = (variables: Record<string, number[]>) => number[];
type FilterMatcher = (variables: Record<string, number[]>) => boolean;

/**
 * 比較 WebView に渡す派生 read model を生成する application service。
 *
 * 式評価、filter 適用、seed の集約、統計値計算は比較ユースケースの知識なので、
 * React コンポーネントではなくここで一元的に扱う。
 */
export class ComparisonViewReadModelService {
  private readonly indexesByData = new WeakMap<ComparisonData, ComparisonDataIndex>();

  build(data: ComparisonData, options: ComparisonViewReadModelOptions): ComparisonViewReadModel {
    const index = this.getIndex(data);

    return {
      chart: this.buildChart(index, options),
      stats: this.calculateStats(index, options.featureString, options.filter),
      validation: this.validateOptions(options),
    };
  }

  validateOptions(
    options: Pick<ComparisonViewOptions, 'xAxis' | 'yAxis' | 'filter'>,
  ): ComparisonViewReadModel['validation'] {
    return {
      xAxis: isValidExpression(options.xAxis),
      yAxis: isValidExpression(options.yAxis),
      filter: options.filter.trim() === '' || isValidExpression(options.filter),
    };
  }

  private buildChart(
    index: ComparisonDataIndex,
    options: ComparisonViewReadModelOptions,
  ): ComparisonChartReadModel {
    const featureNames = parseFeatures(options.featureString);
    const filterMatches = this.createFilterMatcher(options.filter);
    const xAxisEvaluator = this.createExpressionEvaluator(options.xAxis);
    const yAxisEvaluator = this.createExpressionEvaluator(options.yAxis);

    const datasets = index.results.map(({ result, casesBySeed, stderrBySeed }) => {
      const seedDataList: SeedData[] = [];

      if (xAxisEvaluator && yAxisEvaluator) {
        for (const seed of index.seeds) {
          const testCase = casesBySeed.get(seed);
          if (!testCase || (options.skipFailed && testCase.score <= 0)) {
            continue;
          }

          const inputFeatureValues = index.inputFeatureValuesBySeed.get(seed) ?? [];
          const stderrVars = stderrBySeed[seed] || {};
          const variables = this.buildVariables({
            seed,
            testCase,
            inputFeatureValues,
            featureNames,
            stderrVars,
          });

          if (!filterMatches(variables)) {
            continue;
          }

          try {
            const xResult = xAxisEvaluator(variables);
            seedDataList.push({
              seed,
              xValue: xResult[0],
              testCase,
              inputFeatureValues,
              stderrVars,
            });
          } catch {}
        }
      }

      const chartData =
        yAxisEvaluator === null
          ? []
          : this.buildChartPoints({
              groups: this.groupByX(seedDataList),
              resultId: result.id,
              yAxisEvaluator,
              featureNames,
            });

      chartData.sort((a, b) => a.x - b.x);

      return {
        label: result.time,
        resultId: result.id,
        data: chartData,
      };
    });

    return {
      datasets,
      xAxisLabel: options.xAxis,
      yAxisLabel: options.yAxis,
    };
  }

  private getIndex(data: ComparisonData): ComparisonDataIndex {
    const existing = this.indexesByData.get(data);
    if (existing) {
      return existing;
    }

    const index = this.createIndex(data);
    this.indexesByData.set(data, index);
    return index;
  }

  private createIndex(data: ComparisonData): ComparisonDataIndex {
    const inputFeatureValuesBySeed = new Map<number, string[]>();
    for (const seed of data.seeds) {
      inputFeatureValuesBySeed.set(seed, parseFeatures(data.inputData[seed] || ''));
    }

    const results = data.results.map((result): ComparisonResultIndex => {
      const casesBySeed = new Map<number, ComparisonCase>();
      for (const testCase of result.cases) {
        if (!casesBySeed.has(testCase.seed)) {
          casesBySeed.set(testCase.seed, testCase);
        }
      }

      return {
        result,
        casesBySeed,
        stderrBySeed: data.stderrData[result.id] || {},
      };
    });

    const bestScoreBySeed = new Map<number, number>();
    const bestScoreCountBySeed = new Map<number, number>();
    for (const seed of data.seeds) {
      let bestScore = 0;
      let bestScoreCount = 0;

      for (const result of results) {
        const score = result.casesBySeed.get(seed)?.score;
        if (score === undefined) {
          continue;
        }

        if (score > bestScore) {
          bestScore = score;
          bestScoreCount = 1;
        } else if (score === bestScore) {
          bestScoreCount++;
        }
      }

      bestScoreBySeed.set(seed, bestScore);
      bestScoreCountBySeed.set(seed, bestScoreCount);
    }

    return {
      seeds: data.seeds,
      inputFeatureValuesBySeed,
      results,
      bestScoreBySeed,
      bestScoreCountBySeed,
    };
  }

  private createExpressionEvaluator(expression: string): ExpressionEvaluator | null {
    try {
      const ast = parseExpression(expression);
      return (variables) => evaluateAst(ast, variables);
    } catch {
      return null;
    }
  }

  private createFilterMatcher(filter: string): FilterMatcher {
    if (filter.trim() === '') {
      return () => true;
    }

    const evaluator = this.createExpressionEvaluator(filter);
    if (!evaluator) {
      return () => false;
    }

    return (variables) => {
      try {
        const filterResult = evaluator(variables);
        return filterResult[0] === 1;
      } catch {
        return false;
      }
    };
  }

  private buildChartPoints({
    groups,
    resultId,
    yAxisEvaluator,
    featureNames,
  }: {
    groups: Map<number, SeedData[]>;
    resultId: string;
    yAxisEvaluator: ExpressionEvaluator;
    featureNames: string[];
  }): ComparisonChartPoint[] {
    const chartData: ComparisonChartPoint[] = [];

    for (const [xValue, group] of groups.entries()) {
      const variables = this.buildGroupVariables(group, featureNames);

      try {
        const yResult = yAxisEvaluator(variables);

        if (yResult.length === group.length) {
          for (let i = 0; i < group.length; i++) {
            chartData.push({
              x: xValue,
              y: yResult[i],
              resultId,
              seed: group[i].seed,
              variables: {
                seed: group[i].seed,
                absScore: group[i].testCase.score,
                relScore: group[i].testCase.relativeScore,
              },
            });
          }
        } else if (yResult.length === 1) {
          chartData.push({
            x: xValue,
            y: yResult[0],
            resultId,
            seed: group[0].seed,
            variables: {},
            group: group.map((g) => ({
              seed: g.seed,
              y: this.evaluateSingleSeedY(g, yAxisEvaluator, featureNames),
            })),
          });
        }
      } catch {}
    }

    return chartData;
  }

  private calculateStats(
    index: ComparisonDataIndex,
    featuresStr: string,
    filter: string,
  ): ComparisonStatsRow[] {
    const stats: ComparisonStatsRow[] = [];
    const featureNames = parseFeatures(featuresStr);
    const filterMatches = this.createFilterMatcher(filter);

    for (const { result, casesBySeed, stderrBySeed } of index.results) {
      const filteredSeeds = index.seeds.filter((seed) => {
        if (filter.trim() === '') {
          return true;
        }

        const testCase = casesBySeed.get(seed);
        if (!testCase) {
          return false;
        }

        const variables = this.buildVariables({
          seed,
          testCase,
          inputFeatureValues: index.inputFeatureValuesBySeed.get(seed) ?? [],
          featureNames,
          stderrVars: stderrBySeed[seed] || {},
        });

        return filterMatches(variables);
      });

      const scores: number[] = [];
      let totalScore = 0;
      let bestCount = 0;
      let uniqueBestCount = 0;
      let failCount = 0;

      for (const seed of filteredSeeds) {
        const testCase = casesBySeed.get(seed);
        if (testCase && testCase.score > 0) {
          scores.push(testCase.score);
          totalScore += testCase.score;

          const bestScore = index.bestScoreBySeed.get(seed) ?? 0;
          if (testCase.score === bestScore && bestScore > 0) {
            bestCount++;
            if ((index.bestScoreCountBySeed.get(seed) ?? 0) === 1) {
              uniqueBestCount++;
            }
          }
        } else {
          failCount++;
        }
      }

      const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const variance =
        scores.length > 0
          ? scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length
          : 0;

      stats.push({
        name: result.time,
        totalScore,
        mean: Math.round(mean),
        sd: Math.round(Math.sqrt(variance)),
        bestCount,
        uniqueBestCount,
        failCount,
        filteredCount: filteredSeeds.length,
        totalCount: index.seeds.length,
      });
    }

    return stats;
  }

  private buildVariables({
    seed,
    testCase,
    inputFeatureValues,
    featureNames,
    stderrVars,
  }: {
    seed: number;
    testCase: ComparisonCase;
    inputFeatureValues: string[];
    featureNames: string[];
    stderrVars: Record<string, number>;
  }): Record<string, number[]> {
    const variables: Record<string, number[]> = {
      seed: [seed],
      absScore: [testCase.score],
      relScore: [testCase.relativeScore],
      msec: [testCase.executionTime * 1000],
    };

    for (let i = 0; i < featureNames.length && i < inputFeatureValues.length; i++) {
      variables[featureNames[i]] = [toNumber(inputFeatureValues[i])];
    }

    for (const [varName, value] of Object.entries(stderrVars)) {
      variables[`$${varName}`] = [value];
    }

    return variables;
  }

  private buildGroupVariables(group: SeedData[], featureNames: string[]): Record<string, number[]> {
    const variables: Record<string, number[]> = {
      seed: group.map((d) => d.seed),
      absScore: group.map((d) => d.testCase.score),
      relScore: group.map((d) => d.testCase.relativeScore),
      msec: group.map((d) => d.testCase.executionTime * 1000),
    };

    for (let i = 0; i < featureNames.length; i++) {
      variables[featureNames[i]] = group.map((d) => toNumber(d.inputFeatureValues[i]));
    }

    const allStderrVarNames = new Set<string>();
    for (const d of group) {
      for (const varName of Object.keys(d.stderrVars)) {
        allStderrVarNames.add(varName);
      }
    }

    for (const varName of allStderrVarNames) {
      variables[`$${varName}`] = group.map((d) => d.stderrVars[varName] || 0);
    }

    return variables;
  }

  private groupByX(seedDataList: SeedData[]): Map<number, SeedData[]> {
    const groupedByX = new Map<number, SeedData[]>();
    for (const seedData of seedDataList) {
      const key = seedData.xValue;
      if (!groupedByX.has(key)) {
        groupedByX.set(key, []);
      }
      groupedByX.get(key)?.push(seedData);
    }
    return groupedByX;
  }

  private evaluateSingleSeedY(
    seedData: SeedData,
    yAxisEvaluator: ExpressionEvaluator,
    featureNames: string[],
  ): number {
    const singleVars = this.buildVariables({
      seed: seedData.seed,
      testCase: seedData.testCase,
      inputFeatureValues: seedData.inputFeatureValues,
      featureNames,
      stderrVars: seedData.stderrVars,
    });

    try {
      const singleY = yAxisEvaluator(singleVars);
      return singleY[0];
    } catch {
      return seedData.testCase.score;
    }
  }
}

function toNumber(value: string | undefined): number {
  return Number(value) || 0;
}
