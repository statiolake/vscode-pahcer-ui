import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateStats } from '../../src/presentation/view/webview/comparison/statsCalculator';
import type { ComparisonData } from '../../src/presentation/view/webview/comparison/types';

function createComparisonData(overrides: Partial<ComparisonData> = {}): ComparisonData {
  return {
    results: [
      {
        id: 'run-a',
        time: 'Run A',
        cases: [
          { seed: 0, score: 100, relativeScore: 100, executionTime: 1 },
          { seed: 1, score: 50, relativeScore: 100, executionTime: 1 },
        ],
      },
      {
        id: 'run-b',
        time: 'Run B',
        cases: [
          { seed: 0, score: 80, relativeScore: 80, executionTime: 1 },
          { seed: 1, score: 60, relativeScore: 120, executionTime: 1 },
        ],
      },
    ],
    seeds: [0, 1],
    inputData: {
      0: '100 10',
      1: '50 5',
    },
    stderrData: {},
    rankingPool: [
      {
        id: 'run-a',
        comment: '',
        cases: [
          { seed: 0, score: 100 },
          { seed: 1, score: 50 },
        ],
      },
      {
        id: 'run-b',
        comment: '',
        cases: [
          { seed: 0, score: 80 },
          { seed: 1, score: 60 },
        ],
      },
      {
        id: 'run-c',
        comment: '',
        cases: [
          { seed: 0, score: 100 },
          { seed: 1, score: 40 },
        ],
      },
    ],
    objective: 'max',
    config: {
      featureString: 'N M',
      xAxis: 'seed',
      yAxis: 'absScore',
      chartType: 'line',
      filter: '',
      bestRankingInclude: '',
      bestRankingExclude: '',
    },
    ...overrides,
  };
}

describe('calculateStats rank columns', () => {
  it('assigns Rank from all seeds in ranking pool', () => {
    const stats = calculateStats(createComparisonData(), 'N M', '', '', '');

    const runA = stats.find((row) => row.id === 'run-a');
    const runB = stats.find((row) => row.id === 'run-b');

    assert.equal(runA?.rank, 1);
    assert.equal(runB?.rank, 2);
    assert.equal(runA?.subRank, undefined);
  });

  it('assigns SubRank when input-only filter yields identical seed sets', () => {
    const stats = calculateStats(createComparisonData(), 'N M', 'N >= 60', '', '');

    const runA = stats.find((row) => row.id === 'run-a');
    const runB = stats.find((row) => row.id === 'run-b');

    assert.equal(runA?.filteredCount, 1);
    assert.equal(runB?.filteredCount, 1);
    assert.equal(runA?.subRank, 1);
    assert.equal(runB?.subRank, 3);
  });

  it('shows SubRank as undefined when score-dependent filter yields different seed sets', () => {
    const data = createComparisonData({
      results: [
        {
          id: 'run-a',
          time: 'Run A',
          cases: [
            { seed: 0, score: 100, relativeScore: 100, executionTime: 1 },
            { seed: 1, score: 10, relativeScore: 100, executionTime: 1 },
          ],
        },
        {
          id: 'run-b',
          time: 'Run B',
          cases: [
            { seed: 0, score: 80, relativeScore: 80, executionTime: 1 },
            { seed: 1, score: 90, relativeScore: 120, executionTime: 1 },
          ],
        },
      ],
    });

    const stats = calculateStats(data, 'N M', 'absScore >= 50', '', '');

    assert.equal(stats.find((row) => row.id === 'run-a')?.subRank, undefined);
    assert.equal(stats.find((row) => row.id === 'run-b')?.subRank, undefined);
    assert.notEqual(stats.find((row) => row.id === 'run-a')?.rank, undefined);
  });
});
