import { useMemo } from 'react';
import { BestRankingCalculator } from '../../../../../domain/services/bestRankingCalculator';
import { BestScoreCalculator } from '../../../../../domain/services/bestScoreCalculator';
import { evaluateExpression } from '../../shared/utils/expression';
import { parseFeatures } from '../../shared/utils/features';
import type { ComparisonData, StatsRow } from '../types';

interface Props {
  data: ComparisonData;
  featureString: string;
  filter: string;
  bestRankingInclude: string;
  bestRankingExclude: string;
}

export function StatsTable({
  data,
  featureString,
  filter,
  bestRankingInclude,
  bestRankingExclude,
}: Props) {
  const stats = useMemo(
    () => calculateStats(data, featureString, filter, bestRankingInclude, bestRankingExclude),
    [data, featureString, filter, bestRankingInclude, bestRankingExclude],
  );

  const sectionStyle = {
    marginBottom: '20px',
    padding: '10px',
    border: '1px solid var(--vscode-panel-border)',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
  };

  const cellStyle = {
    padding: '8px',
    textAlign: 'left' as const,
  };

  const thStyle = {
    ...cellStyle,
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontWeight: 'bold' as const,
  };

  return (
    <div style={sectionStyle}>
      <div
        style={{
          marginBottom: '10px',
          fontSize: '0.9em',
          color: 'var(--vscode-descriptionForeground)',
        }}
      >
        統計情報
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>実行</th>
            <th style={thStyle}>スコア合計</th>
            <th style={thStyle}>Mean ± SD</th>
            <th style={thStyle}>#Best</th>
            <th style={thStyle}>#Unique</th>
            <th style={thStyle}>#Fail</th>
            {filter.trim() !== '' && <th style={thStyle}>フィルタ後件数</th>}
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.name}>
              <td style={cellStyle}>{stat.name}</td>
              <td style={cellStyle}>{stat.totalScore.toLocaleString()}</td>
              <td style={cellStyle}>
                {stat.mean.toLocaleString()} ± {stat.sd.toLocaleString()}
              </td>
              <td style={cellStyle}>{stat.bestCount}</td>
              <td style={cellStyle}>{stat.uniqueBestCount}</td>
              <td style={cellStyle}>{stat.failCount}</td>
              {filter.trim() !== '' && (
                <td style={cellStyle}>
                  {stat.filteredCount}/{stat.totalCount}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function calculateStats(
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

  for (const result of results) {
    // Apply filter for this specific result
    const filteredSeeds = seeds.filter((seed) => {
      if (filter.trim() === '') return true;

      const inputLine = inputData[seed] || '';
      const variables: Record<string, number[]> = {};
      variables.seed = [seed];

      const testCase = result.cases.find((c) => c.seed === seed);
      if (!testCase) return false;

      variables.absScore = [testCase.score];
      variables.relScore = [testCase.relativeScore];
      variables.msec = [testCase.executionTime * 1000];

      const featureValues = parseFeatures(inputLine);
      for (let i = 0; i < features.length && i < featureValues.length; i++) {
        variables[features[i]] = [Number(featureValues[i]) || 0];
      }

      // Get stderr variables
      const stderrVars = stderrData[result.id]?.[seed] || {};
      for (const [varName, value] of Object.entries(stderrVars)) {
        variables[`$${varName}`] = [value];
      }

      try {
        const filterResult = evaluateExpression(filter, variables);
        return filterResult[0] === 1;
      } catch (e) {
        console.warn(`Filter evaluation failed for seed ${seed}:`, e);
        return false;
      }
    });

    // Calculate stats for this result with its filtered seeds
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
      name: result.time,
      totalScore,
      mean: Math.round(mean),
      sd: Math.round(sd),
      bestCount,
      uniqueBestCount,
      failCount,
      filteredCount: filteredSeeds.length,
      totalCount: seeds.length,
    });
  }

  return stats;
}
