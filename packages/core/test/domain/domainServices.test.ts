import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import { Execution } from '../../src/domain/models/execution';
import { TestCase, TestCaseId } from '../../src/domain/models/testCase';
import { ExecutionSorter } from '../../src/domain/services/executionSorter';
import { ExecutionStatsCalculator } from '../../src/domain/services/executionStatsAggregator';
import { RelativeScoreCalculator } from '../../src/domain/services/relativeScoreCalculator';
import { SeedExecutionSorter } from '../../src/domain/services/seedExecutionSorter';
import { SeedStatsCalculator } from '../../src/domain/services/seedStatsCalculator';
import { SeedStatsSorter } from '../../src/domain/services/seedStatsSorter';
import { StderrParser } from '../../src/domain/services/stderrParser';
import { TestCaseGrouper } from '../../src/domain/services/testCaseGrouper';
import { TestCaseSorter } from '../../src/domain/services/testCaseSorter';

describe('domain services', () => {
  it('sorts executions by start time without mutating input', () => {
    const older = execution('e1', '2026-01-01T00:00:00');
    const newer = execution('e2', '2026-01-02T00:00:00');
    const input = [older, newer];

    assert.deepEqual(
      ExecutionSorter.byTimeDescending(input).map((item) => item.id),
      ['e2', 'e1'],
    );
    assert.deepEqual(
      ExecutionSorter.byTimeAscending(input).map((item) => item.id),
      ['e1', 'e2'],
    );
    assert.deepEqual(
      input.map((item) => item.id),
      ['e1', 'e2'],
    );
  });

  it('groups test cases by seed and skips cases without matching execution', () => {
    const executions = [execution('e1'), execution('e2')];
    const groups = TestCaseGrouper.bySeed(
      [
        caseLike('e1', 2, 20),
        caseLike('missing', 1, 1),
        caseLike('e2', 1, 10),
        caseLike('e1', 1, 5),
      ],
      executions,
    );

    assert.deepEqual(
      groups.map((group) => group.seed),
      [1, 2],
    );
    assert.deepEqual(
      groups[0].executions.map((item) => `${item.execution.id}:${item.testCase.score}`),
      ['e2:10', 'e1:5'],
    );
  });

  it('sorts test cases by seed, absolute score, and relative score', () => {
    const cases = [testCase('e1', 2, 20), testCase('e1', 1, 30), testCase('e1', 3, 10)];
    const relativeScores = new Map([
      [1, 40],
      [2, 80],
      [3, 20],
    ]);

    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'seedAsc').map((item) => item.id.seed),
      [1, 2, 3],
    );
    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'seedDesc').map((item) => item.id.seed),
      [3, 2, 1],
    );
    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'absoluteScoreAsc').map((item) => item.id.seed),
      [3, 2, 1],
    );
    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'absoluteScoreDesc').map((item) => item.id.seed),
      [1, 2, 3],
    );
    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'relativeScoreAsc', relativeScores).map((item) => item.id.seed),
      [3, 1, 2],
    );
    assert.deepEqual(
      TestCaseSorter.byOrder(cases, 'relativeScoreDesc', relativeScores).map(
        (item) => item.id.seed,
      ),
      [2, 1, 3],
    );
  });

  it('sorts seed executions by execution id and absolute score', () => {
    const cases = [
      { execution: execution('e2'), testCase: { score: 20 } },
      { execution: execution('e1'), testCase: { score: 30 } },
      { execution: execution('e3'), testCase: { score: 10 } },
    ];

    assert.deepEqual(
      SeedExecutionSorter.byOrder(cases, 'executionAsc').map((item) => item.execution.id),
      ['e1', 'e2', 'e3'],
    );
    assert.deepEqual(
      SeedExecutionSorter.byOrder(cases, 'executionDesc').map((item) => item.execution.id),
      ['e3', 'e2', 'e1'],
    );
    assert.deepEqual(
      SeedExecutionSorter.byOrder(cases, 'absoluteScoreAsc').map((item) => item.execution.id),
      ['e3', 'e2', 'e1'],
    );
    assert.deepEqual(
      SeedExecutionSorter.byOrder(cases, 'absoluteScoreDesc').map((item) => item.execution.id),
      ['e1', 'e2', 'e3'],
    );
  });

  it('calculates execution stats for max and min objectives', () => {
    const executions = [execution('e1'), execution('e2')];
    const cases = [
      caseLike('e1', 0, 10, 1),
      caseLike('e1', 1, 0, 2),
      caseLike('e2', 0, 20, 3),
      caseLike('e2', 1, 5, 4),
    ];
    const maxStats = ExecutionStatsCalculator.calculate(
      executions,
      cases,
      new Map([
        [0, 20],
        [1, 5],
      ]),
      'max',
    );
    const minStats = ExecutionStatsCalculator.calculate(
      [execution('e1')],
      [caseLike('e1', 0, 5), caseLike('e1', 1, 10)],
      new Map([
        [0, 5],
        [1, 5],
      ]),
      'min',
    );

    assert.equal(maxStats[0].caseCount, 2);
    assert.equal(maxStats[0].totalScore, 10);
    assert.equal(maxStats[0].maxExecutionTime, 2);
    assert.deepEqual(maxStats[0].waSeeds, [1]);
    assert.equal(maxStats[0].acCount, 1);
    assert.equal(maxStats[0].averageScore, 5);
    assert.equal(maxStats[0].averageRelativeScore, 25);
    assert.equal(maxStats[1].averageRelativeScore, 100);
    assert.equal(minStats[0].averageRelativeScore, 75);
  });

  it('calculates seed stats and sorts them by seed', () => {
    const statsMap = SeedStatsCalculator.calculate(
      [caseLike('e1', 2, 20, 3), caseLike('e2', 1, 10, 1), caseLike('e3', 2, 30, 5)],
      new Map([
        [1, 10],
        [2, 30],
      ]),
    );

    assert.equal(statsMap.get(2)?.count, 2);
    assert.equal(statsMap.get(2)?.averageScore, 25);
    assert.equal(statsMap.get(2)?.maxExecutionTime, 5);
    assert.deepEqual(
      SeedStatsSorter.bySeedAscending(statsMap).map((stats) => stats.seed),
      [1, 2],
    );
    assert.deepEqual(
      SeedStatsSorter.bySeedDescending(statsMap).map((stats) => stats.seed),
      [2, 1],
    );
  });

  it('calculates relative scores for max, min, and invalid inputs', () => {
    assert.equal(RelativeScoreCalculator.calculate(50, 100, 'max'), 50);
    assert.equal(RelativeScoreCalculator.calculate(50, 25, 'min'), 50);
    assert.equal(RelativeScoreCalculator.calculate(0, 100, 'max'), 0);
    assert.equal(RelativeScoreCalculator.calculate(10, undefined, 'max'), 0);
    assert.deepEqual(
      Array.from(RelativeScoreCalculator.calculateMultiple([10, 20], 20, 'max').entries()),
      [
        [10, 50],
        [20, 100],
      ],
    );
  });

  it('parses numeric variables from stderr lines', () => {
    assert.deepEqual(
      StderrParser.parseVariables(`
$score = 12
ignored
$negative = -3.5
$bad-name = 7
$value_2 = 0.25
`),
      {
        score: 12,
        negative: -3.5,
        value_2: 0.25,
      },
    );
  });
});

function execution(id: string, isoTime = '2026-01-01T00:00:00'): Execution {
  return new Execution(id, dayjs(isoTime), '', null);
}

function testCase(executionId: string, seed: number, score: number): TestCase {
  return new TestCase(new TestCaseId(executionId, seed), score, 1, '', true);
}

function caseLike(executionId: string, seed: number, score: number, executionTime = 1) {
  return {
    id: { executionId, seed },
    score,
    executionTime,
  };
}
