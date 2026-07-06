import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SubmissionRankCalculator } from '../../src/domain/services/submissionRankCalculator';

describe('SubmissionRankCalculator', () => {
  const pool = [
    {
      id: 'a',
      cases: [
        { seed: 0, score: 100 },
        { seed: 1, score: 50 },
      ],
    },
    {
      id: 'b',
      cases: [
        { seed: 0, score: 80 },
        { seed: 1, score: 60 },
      ],
    },
    {
      id: 'c',
      cases: [
        { seed: 0, score: 100 },
        { seed: 1, score: 40 },
      ],
    },
  ];

  it('haveIdenticalSeedSets returns true for matching sets', () => {
    assert.equal(
      SubmissionRankCalculator.haveIdenticalSeedSets([
        [0, 1, 2],
        [2, 0, 1],
      ]),
      true,
    );
  });

  it('haveIdenticalSeedSets returns false for different sets', () => {
    assert.equal(
      SubmissionRankCalculator.haveIdenticalSeedSets([
        [0, 1],
        [0, 2],
      ]),
      false,
    );
  });

  it('rankByScores uses competition ranking for ties', () => {
    const scores = new Map([
      ['a', 100],
      ['b', 80],
      ['c', 100],
    ]);

    const ranks = SubmissionRankCalculator.rankByScores(scores, 'max');
    assert.deepEqual(
      [...ranks.entries()].sort((x, y) => x[0].localeCompare(y[0])),
      [
        ['a', 1],
        ['b', 3],
        ['c', 1],
      ],
    );
  });

  it('computeRankMaps assigns full Rank on all seeds', () => {
    const { rank } = SubmissionRankCalculator.computeRankMaps({
      rankingPool: pool,
      allSeeds: [0, 1],
      filteredSeedsPerSelectedResult: [[0, 1]],
      objective: 'max',
    });

    assert.equal(rank.get('a'), 1);
    assert.equal(rank.get('c'), 2);
    assert.equal(rank.get('b'), 2);
  });

  it('computeRankMaps assigns SubRank on filtered seeds when sets match', () => {
    const { subRank } = SubmissionRankCalculator.computeRankMaps({
      rankingPool: pool,
      allSeeds: [0, 1],
      filteredSeedsPerSelectedResult: [[0]],
      objective: 'max',
    });

    assert.ok(subRank);
    assert.equal(subRank.get('a'), 1);
    assert.equal(subRank.get('c'), 1);
    assert.equal(subRank.get('b'), 3);
  });

  it('computeRankMaps omits SubRank when selected seed sets differ', () => {
    const { subRank } = SubmissionRankCalculator.computeRankMaps({
      rankingPool: pool,
      allSeeds: [0, 1],
      filteredSeedsPerSelectedResult: [[0, 1], [0]],
      objective: 'max',
    });

    assert.equal(subRank, undefined);
  });

  it('rankByScores ranks lower totals higher for min objective', () => {
    const scores = new Map([
      ['a', 120],
      ['b', 80],
      ['c', 100],
    ]);

    const ranks = SubmissionRankCalculator.rankByScores(scores, 'min');
    assert.equal(ranks.get('b'), 1);
    assert.equal(ranks.get('c'), 2);
    assert.equal(ranks.get('a'), 3);
  });
});
