import { BestRankingCalculator } from '../../../../domain/services/bestRankingCalculator';
import { BestScoreCalculator } from '../../../../domain/services/bestScoreCalculator';
import { SubmissionRankCalculator } from '../../../../domain/services/submissionRankCalculator';
import { buildChartVariables } from '../shared/utils/chartVariables';
import { evaluateExpression } from '../shared/utils/expression';
import { parseFeatures } from '../shared/utils/features';
import type { ComparisonData, ResultData, StatsRow } from './types';

export function calculateStats(
  data: ComparisonData,
  featuresStr: string,
  filter: string,
  bestRankingInclude: string,
  bestRankingExclude: string,
): StatsRow[] {
  const stats: StatsRow[] = [];
  const { results, seeds, inputData, stderrData, rankingPool, objective } = data;
  const features = parseFeatures(featuresStr);

  const filteredRankingPool = BestRankingCalculator.filterByComment(
    rankingPool,
    bestRankingInclude,
    bestRankingExclude,
  );
  const bestScores = BestScoreCalculator.calculate(
    BestRankingCalculator.toFlatTestCases(filteredRankingPool),
    objective,
  );
  const bestAchieverCounts = BestRankingCalculator.countBestAchieversPerSeed(
    filteredRankingPool,
    bestScores,
  );

  const filteredSeedsPerResult = results.map((result) =>
    filterSeeds(seeds, filter, features, inputData, stderrData, result),
  );
  const hasFilter = filter.trim() !== '';

  const rankById = SubmissionRankCalculator.rankByScores(
    SubmissionRankCalculator.calculateTotalScores(filteredRankingPool, seeds),
    objective,
  );

  const subRankById = hasFilter
    ? SubmissionRankCalculator.computeRankMaps({
        rankingPool: filteredRankingPool,
        allSeeds: seeds,
        filteredSeedsPerSelectedResult: filteredSeedsPerResult,
        objective,
      }).subRank
    : undefined;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const filteredSeeds = filteredSeedsPerResult[i];

    const scores: number[] = [];
    let totalScore = 0;
    let bestCount = 0;
    let uniqueBestCount = 0;
    let failCount = 0;

    for (const seed of filteredSeeds) {
      const testCase = result.cases.find((c) => c.seed === seed);
      if (testCase) {
        if (testCase.score > 0) {
          scores.push(testCase.score);
          totalScore += testCase.score;

          const bestScore = bestScores.get(seed);
          if (bestScore !== undefined && testCase.score === bestScore) {
            bestCount++;
            if (bestAchieverCounts.get(seed) === 1) {
              uniqueBestCount++;
            }
          }
        } else {
          failCount++;
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
    const sd = Math.sqrt(variance);

    stats.push({
      id: result.id,
      name: result.time,
      totalScore,
      mean: Math.round(mean),
      sd: Math.round(sd),
      bestCount,
      uniqueBestCount,
      failCount,
      filteredCount: filteredSeeds.length,
      totalCount: seeds.length,
      rank: rankById.get(result.id),
      subRank: subRankById?.get(result.id),
    });
  }

  return stats;
}

export function filterSeeds(
  seeds: number[],
  filter: string,
  features: string[],
  inputData: Record<number, string>,
  stderrData: Record<string, Record<number, Record<string, number>>>,
  result: ResultData | undefined,
): number[] {
  if (filter.trim() === '') {
    return seeds;
  }

  return seeds.filter((seed) => {
    const inputLine = inputData[seed] || '';
    const testCase = result?.cases.find((c) => c.seed === seed);

    const variables = buildChartVariables({
      caseData: testCase
        ? {
            seed,
            score: testCase.score,
            relativeScore: testCase.relativeScore,
            executionTime: testCase.executionTime,
          }
        : { seed, score: 0, relativeScore: 0, executionTime: 0 },
      features,
      inputLine,
      stderrVars: result ? stderrData[result.id]?.[seed] || {} : {},
    });

    try {
      const filterResult = evaluateExpression(filter, variables);
      return filterResult[0] === 1;
    } catch (e) {
      console.warn(`Filter evaluation failed for seed ${seed}:`, e);
      return false;
    }
  });
}
