import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BestScoreCalculator } from '../../src/domain/services/bestScoreCalculator';

describe('BestScoreCalculator', () => {
  it('selects the highest positive score for max objective', () => {
    const bestScores = BestScoreCalculator.calculate(
      [
        { id: { seed: 0 }, score: 10 },
        { id: { seed: 0 }, score: 30 },
        { id: { seed: 1 }, score: 0 },
        { id: { seed: 1 }, score: 15 },
      ],
      'max',
    );

    assert.equal(bestScores.get(0), 30);
    assert.equal(bestScores.get(1), 15);
  });

  it('selects the lowest positive score for min objective and ignores failed cases', () => {
    const bestScores = BestScoreCalculator.calculate(
      [
        { id: { seed: 0 }, score: 10 },
        { id: { seed: 0 }, score: 3 },
        { id: { seed: 0 }, score: -1 },
        { id: { seed: 1 }, score: 0 },
      ],
      'min',
    );

    assert.equal(bestScores.get(0), 3);
    assert.equal(bestScores.has(1), false);
  });
});
