import type {
  ComparisonChartPoint,
  ComparisonChartReadModel,
  ComparisonData,
  ComparisonStatsRow,
  ComparisonViewOptions,
  ComparisonViewReadModel,
} from '../dtos/comparisonData';
import { evaluateExpression, isValidExpression } from './comparisonExpressionService';
import { parseFeatures } from './featureParser';

type ComparisonCase = ComparisonData['results'][number]['cases'][number];

interface SeedData {
  seed: number;
  xValue: number;
  testCase: ComparisonCase;
  inputLine: string;
}

/**
 * 比較 WebView に渡す派生 read model を生成する application service。
 *
 * 式評価、filter 適用、seed の集約、統計値計算は比較ユースケースの知識なので、
 * React コンポーネントではなくここで一元的に扱う。
 */
export class ComparisonViewReadModelService {
  build(data: ComparisonData, options: ComparisonViewOptions): ComparisonViewReadModel {
    return {
      chart: this.buildChart(data, options),
      stats: this.calculateStats(data, options.featureString, options.filter),
      validation: {
        xAxis: isValidExpression(options.xAxis),
        yAxis: isValidExpression(options.yAxis),
        filter: options.filter.trim() === '' || isValidExpression(options.filter),
      },
    };
  }

  private buildChart(
    data: ComparisonData,
    options: ComparisonViewOptions,
  ): ComparisonChartReadModel {
    const features = parseFeatures(options.featureString);
    const { results, seeds, inputData, stderrData } = data;

    const datasets = results.map((result) => {
      const filteredSeeds = seeds.filter((seed) => {
        if (!options.skipFailed) {
          return true;
        }
        const testCase = result.cases.find((c) => c.seed === seed);
        return testCase !== undefined && testCase.score > 0;
      });

      const seedDataList: SeedData[] = filteredSeeds
        .map((seed) => {
          const testCase = result.cases.find((c) => c.seed === seed);
          if (!testCase) {
            return undefined;
          }

          const inputLine = inputData[seed] || '';
          const variables = this.buildVariables({
            seed,
            testCase,
            inputLine,
            featureNames: features,
            stderrVars: stderrData[result.id]?.[seed] || {},
          });

          if (!this.matchesFilter(options.filter, variables)) {
            return undefined;
          }

          try {
            const xResult = evaluateExpression(options.xAxis, variables);
            return { seed, xValue: xResult[0], testCase, inputLine };
          } catch {
            return undefined;
          }
        })
        .filter((value): value is SeedData => value !== undefined);

      const groupedByX = this.groupByX(seedDataList);
      const chartData = this.buildChartPoints({
        groups: groupedByX,
        resultId: result.id,
        yAxis: options.yAxis,
        featureNames: features,
        stderrData: stderrData[result.id] || {},
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

  private buildChartPoints({
    groups,
    resultId,
    yAxis,
    featureNames,
    stderrData,
  }: {
    groups: Map<number, SeedData[]>;
    resultId: string;
    yAxis: string;
    featureNames: string[];
    stderrData: Record<number, Record<string, number>>;
  }): ComparisonChartPoint[] {
    const chartData: ComparisonChartPoint[] = [];

    for (const [xValue, group] of groups.entries()) {
      const variables = this.buildGroupVariables(group, featureNames, stderrData);

      try {
        const yResult = evaluateExpression(yAxis, variables);

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
              y: this.evaluateSingleSeedY(g, yAxis, featureNames, stderrData[g.seed] || {}),
            })),
          });
        }
      } catch {}
    }

    return chartData;
  }

  private calculateStats(
    data: ComparisonData,
    featuresStr: string,
    filter: string,
  ): ComparisonStatsRow[] {
    const stats: ComparisonStatsRow[] = [];
    const { results, seeds, inputData, stderrData } = data;
    const features = parseFeatures(featuresStr);

    for (const result of results) {
      const filteredSeeds = seeds.filter((seed) => {
        if (filter.trim() === '') {
          return true;
        }

        const testCase = result.cases.find((c) => c.seed === seed);
        if (!testCase) {
          return false;
        }

        const variables = this.buildVariables({
          seed,
          testCase,
          inputLine: inputData[seed] || '',
          featureNames: features,
          stderrVars: stderrData[result.id]?.[seed] || {},
        });

        return this.matchesFilter(filter, variables);
      });

      const bests = this.calculateBestScoresForFilteredSeeds(data, filteredSeeds);
      const scores: number[] = [];
      let totalScore = 0;
      let bestCount = 0;
      let uniqueBestCount = 0;
      let failCount = 0;

      for (const seed of filteredSeeds) {
        const testCase = result.cases.find((c) => c.seed === seed);
        if (testCase && testCase.score > 0) {
          scores.push(testCase.score);
          totalScore += testCase.score;

          if (testCase.score === bests[seed] && bests[seed] > 0) {
            bestCount++;
            const othersWithSameScore = results.filter((r) => {
              const tc = r.cases.find((c) => c.seed === seed);
              return tc !== undefined && tc.score === bests[seed];
            }).length;
            if (othersWithSameScore === 1) {
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
        totalCount: seeds.length,
      });
    }

    return stats;
  }

  private buildVariables({
    seed,
    testCase,
    inputLine,
    featureNames,
    stderrVars,
  }: {
    seed: number;
    testCase: ComparisonCase;
    inputLine: string;
    featureNames: string[];
    stderrVars: Record<string, number>;
  }): Record<string, number[]> {
    const variables: Record<string, number[]> = {
      seed: [seed],
      absScore: [testCase.score],
      relScore: [testCase.relativeScore],
      msec: [testCase.executionTime * 1000],
    };

    const featureValues = parseFeatures(inputLine);
    for (let i = 0; i < featureNames.length && i < featureValues.length; i++) {
      variables[featureNames[i]] = [Number(featureValues[i]) || 0];
    }

    for (const [varName, value] of Object.entries(stderrVars)) {
      variables[`$${varName}`] = [value];
    }

    return variables;
  }

  private buildGroupVariables(
    group: SeedData[],
    featureNames: string[],
    stderrData: Record<number, Record<string, number>>,
  ): Record<string, number[]> {
    const variables: Record<string, number[]> = {
      seed: group.map((d) => d.seed),
      absScore: group.map((d) => d.testCase.score),
      relScore: group.map((d) => d.testCase.relativeScore),
      msec: group.map((d) => d.testCase.executionTime * 1000),
    };

    for (const featureName of featureNames) {
      variables[featureName] = group.map((d) => {
        const featureValues = parseFeatures(d.inputLine);
        const featureIndex = featureNames.indexOf(featureName);
        return Number(featureValues[featureIndex]) || 0;
      });
    }

    const allStderrVarNames = new Set<string>();
    for (const d of group) {
      for (const varName of Object.keys(stderrData[d.seed] || {})) {
        allStderrVarNames.add(varName);
      }
    }

    for (const varName of allStderrVarNames) {
      variables[`$${varName}`] = group.map((d) => stderrData[d.seed]?.[varName] || 0);
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

  private matchesFilter(filter: string, variables: Record<string, number[]>): boolean {
    if (filter.trim() === '') {
      return true;
    }

    try {
      const filterResult = evaluateExpression(filter, variables);
      return filterResult[0] === 1;
    } catch {
      return false;
    }
  }

  private evaluateSingleSeedY(
    seedData: SeedData,
    yAxis: string,
    featureNames: string[],
    stderrVars: Record<string, number>,
  ): number {
    const singleVars = this.buildVariables({
      seed: seedData.seed,
      testCase: seedData.testCase,
      inputLine: seedData.inputLine,
      featureNames,
      stderrVars,
    });

    try {
      const singleY = evaluateExpression(yAxis, singleVars);
      return singleY[0];
    } catch {
      return seedData.testCase.score;
    }
  }

  private calculateBestScoresForFilteredSeeds(
    data: ComparisonData,
    filteredSeeds: number[],
  ): Record<number, number> {
    const bests: Record<number, number> = {};
    for (const seed of filteredSeeds) {
      let maxScore = 0;
      for (const result of data.results) {
        const testCase = result.cases.find((c) => c.seed === seed);
        if (testCase && testCase.score > maxScore) {
          maxScore = testCase.score;
        }
      }
      bests[seed] = maxScore;
    }
    return bests;
  }
}
