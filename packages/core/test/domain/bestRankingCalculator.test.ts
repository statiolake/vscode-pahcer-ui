import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BestRankingCalculator } from '../../src/domain/services/bestRankingCalculator';
import { BestScoreCalculator } from '../../src/domain/services/bestScoreCalculator';

describe('BestRankingCalculator', () => {
  it('filters executions by include and exclude comment patterns', () => {
    const executions = [
      { id: 'a', comment: 'baseline run', cases: [{ seed: 0, score: 10 }] },
      { id: 'b', comment: 'candidate', cases: [{ seed: 0, score: 20 }] },
      { id: 'c', comment: 'candidate old', cases: [{ seed: 0, score: 30 }] },
    ];

    assert.deepEqual(
      BestRankingCalculator.filterByComment(executions, 'candidate', 'old').map((exec) => exec.id),
      ['b'],
    );
  });

  it('counts best achievers per seed across the ranking pool', () => {
    const executions = [
      { id: 'a', comment: '', cases: [{ seed: 0, score: 10 }] },
      { id: 'b', comment: '', cases: [{ seed: 0, score: 20 }] },
      { id: 'c', comment: '', cases: [{ seed: 0, score: 20 }] },
    ];
    const bestScores = BestScoreCalculator.calculate(
      BestRankingCalculator.toFlatTestCases(executions),
      'max',
    );

    assert.deepEqual(
      [...BestRankingCalculator.countBestAchieversPerSeed(executions, bestScores).entries()],
      [[0, 2]],
    );
  });
});
