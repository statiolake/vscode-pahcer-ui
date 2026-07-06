import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ComparisonConfig } from '../../src/application/dtos/comparisonConfig';
import type {
  ComparisonData,
  ComparisonViewReadModelOptions,
} from '../../src/application/dtos/comparisonData';
import { PahcerTreeData } from '../../src/application/dtos/pahcerTreeData';
import {
  evaluateExpression,
  isValidExpression,
  parseExpression,
} from '../../src/application/services/comparisonExpressionService';
import { ComparisonViewReadModelService } from '../../src/application/services/comparisonViewReadModelService';
import { parseFeatures } from '../../src/application/services/featureParser';

describe('application services', () => {
  it('constructs application DTOs with defaults', () => {
    const comparisonConfig = new ComparisonConfig();
    const treeData = new PahcerTreeData([], [], 'max', new Map(), []);

    assert.deepEqual(
      { ...comparisonConfig },
      {
        featureString: 'N M K',
        xAxis: 'seed',
        yAxis: 'avg(absScore)',
        chartType: 'line',
        skipFailed: true,
        filter: '',
        bestRankingInclude: '',
        bestRankingExclude: '',
      },
    );
    assert.equal(treeData.objective, 'max');
    assert.deepEqual(treeData.executions, []);
  });

  it('parses feature strings', () => {
    assert.deepEqual(parseFeatures(' N  M K '), ['N', 'M', 'K']);
    assert.deepEqual(parseFeatures('   '), []);
  });

  it('validates and evaluates comparison expressions', () => {
    assert.equal(isValidExpression(''), true);
    assert.equal(isValidExpression('avg(absScore) + max($width)'), true);
    assert.equal(isValidExpression('avg('), false);
    assert.deepEqual(
      evaluateExpression('absScore + 10', {
        absScore: [1, 2, 3],
      }),
      [11, 12, 13],
    );
    assert.deepEqual(
      evaluateExpression('absScore > 1', {
        absScore: [1, 2, 3],
      }),
      [0, 1, 1],
    );
    assert.deepEqual(
      evaluateExpression('avg(absScore)', {
        absScore: [1, 2, 3],
      }),
      [2],
    );
    assert.deepEqual(parseExpression('2 + 3 * 4'), {
      type: 'binary',
      operator: '+',
      left: { type: 'number', value: 2 },
      right: {
        type: 'binary',
        operator: '*',
        left: { type: 'number', value: 3 },
        right: { type: 'number', value: 4 },
      },
    });
    assert.throws(() => evaluateExpression('missing', {}), /Unknown variable/);
    assert.throws(() => evaluateExpression('1 / 0', {}), /Division by zero/);
  });

  it('builds chart, stats, and validation read model for comparison view', () => {
    const readModel = new ComparisonViewReadModelService().build(comparisonData(), {
      featureString: 'N M',
      xAxis: 'N',
      yAxis: 'avg(absScore)',
      skipFailed: true,
      filter: '$width >= 10',
      bestRankingInclude: '',
      bestRankingExclude: '',
    });

    assert.deepEqual(readModel.validation, {
      xAxis: true,
      yAxis: true,
      filter: true,
    });
    assert.equal(readModel.chart.xAxisLabel, 'N');
    assert.equal(readModel.chart.yAxisLabel, 'avg(absScore)');
    assert.equal(readModel.chart.datasets.length, 2);
    assert.deepEqual(
      readModel.chart.datasets[0].data.map((point) => ({
        x: point.x,
        y: point.y,
        seed: point.seed,
        group: point.group,
      })),
      [
        { x: 1, y: 10, seed: 0, group: undefined },
        { x: 2, y: 30, seed: 2, group: undefined },
      ],
    );
    assert.deepEqual(readModel.stats[0], {
      id: 'e1',
      name: 'base',
      totalScore: 40,
      mean: 20,
      sd: 10,
      bestCount: 1,
      uniqueBestCount: 0,
      failCount: 0,
      filteredCount: 2,
      totalCount: 3,
      rank: 2,
      subRank: 2,
    });
  });

  it('marks invalid comparison view expressions and drops invalid chart points', () => {
    const readModel = new ComparisonViewReadModelService().build(comparisonData(), {
      ...defaultOptions(),
      xAxis: 'unknown(',
      filter: 'unknown(',
    });

    assert.equal(readModel.validation.xAxis, false);
    assert.equal(readModel.validation.filter, false);
    assert.deepEqual(readModel.chart.datasets[0].data, []);
    assert.equal(readModel.stats[0].filteredCount, 0);
  });

  it('counts #Best using min objective when lower scores are better', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
        objective: 'min',
        results: [
          {
            id: 'e1',
            time: 'base',
            cases: [
              { seed: 0, score: 20, relativeScore: 100, executionTime: 1 },
              { seed: 1, score: 10, relativeScore: 100, executionTime: 2 },
            ],
          },
          {
            id: 'e2',
            time: 'next',
            cases: [
              { seed: 0, score: 10, relativeScore: 100, executionTime: 1 },
              { seed: 1, score: 20, relativeScore: 100, executionTime: 2 },
            ],
          },
        ],
        seeds: [0, 1],
        rankingPool: [
          {
            id: 'e1',
            comment: '',
            cases: [
              { seed: 0, score: 20 },
              { seed: 1, score: 10 },
            ],
          },
          {
            id: 'e2',
            comment: '',
            cases: [
              { seed: 0, score: 10 },
              { seed: 1, score: 20 },
            ],
          },
        ],
      },
      {
        featureString: 'N M',
        xAxis: 'seed',
        yAxis: 'absScore',
        skipFailed: false,
        filter: '',
        bestRankingInclude: '',
        bestRankingExclude: '',
      },
    );

    assert.equal(readModel.stats[0].bestCount, 1);
    assert.equal(readModel.stats[1].bestCount, 1);
  });

  it('counts #Best against all submissions in ranking pool, not only selected results', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
        results: [comparisonData().results[0]],
        rankingPool: [
          {
            id: 'e1',
            comment: 'baseline',
            cases: [
              { seed: 0, score: 10 },
              { seed: 2, score: 30 },
            ],
          },
          {
            id: 'e2',
            comment: 'candidate',
            cases: [
              { seed: 0, score: 20 },
              { seed: 2, score: 30 },
            ],
          },
          {
            id: 'e3',
            comment: 'hidden',
            cases: [{ seed: 0, score: 100 }],
          },
        ],
      },
      defaultOptions(),
    );

    assert.equal(readModel.stats[0].bestCount, 1);
  });

  it('filters ranking pool by comment when counting #Best', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
        rankingPool: [
          { id: 'e1', comment: 'keep', cases: [{ seed: 0, score: 10 }] },
          { id: 'e2', comment: 'drop', cases: [{ seed: 0, score: 100 }] },
        ],
      },
      {
        ...defaultOptions(),
        bestRankingExclude: 'drop',
      },
    );

    assert.equal(readModel.stats[0].bestCount, 1);
    assert.equal(readModel.stats[1].bestCount, 0);
  });

  it('assigns Rank from all seeds in ranking pool', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
        rankingPool: [
          {
            id: 'e1',
            comment: '',
            cases: [
              { seed: 0, score: 10 },
              { seed: 2, score: 30 },
            ],
          },
          {
            id: 'e2',
            comment: '',
            cases: [
              { seed: 0, score: 20 },
              { seed: 2, score: 30 },
            ],
          },
          {
            id: 'e3',
            comment: '',
            cases: [
              { seed: 0, score: 100 },
              { seed: 2, score: 40 },
            ],
          },
        ],
      },
      defaultOptions(),
    );

    assert.equal(readModel.stats.find((row) => row.id === 'e1')?.rank, 3);
    assert.equal(readModel.stats.find((row) => row.id === 'e2')?.rank, 2);
    assert.equal(readModel.stats.find((row) => row.id === 'e1')?.subRank, undefined);
  });

  it('assigns SubRank when filter yields identical seed sets across selected results', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
        inputData: {
          0: '100 10',
          1: '50 5',
          2: '2 30',
        },
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
      },
      {
        ...defaultOptions(),
        featureString: 'N M',
        filter: 'N >= 60',
      },
    );

    const runA = readModel.stats.find((row) => row.id === 'run-a');
    const runB = readModel.stats.find((row) => row.id === 'run-b');

    assert.equal(runA?.filteredCount, 1);
    assert.equal(runB?.filteredCount, 1);
    assert.equal(runA?.subRank, 1);
    assert.equal(runB?.subRank, 3);
  });

  it('omits SubRank when score-dependent filter yields different seed sets', () => {
    const readModel = new ComparisonViewReadModelService().build(
      {
        ...comparisonData(),
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
        seeds: [0, 1],
        rankingPool: [
          {
            id: 'run-a',
            comment: '',
            cases: [
              { seed: 0, score: 100 },
              { seed: 1, score: 10 },
            ],
          },
          {
            id: 'run-b',
            comment: '',
            cases: [
              { seed: 0, score: 80 },
              { seed: 1, score: 90 },
            ],
          },
        ],
      },
      {
        ...defaultOptions(),
        filter: 'absScore >= 50',
      },
    );

    assert.equal(readModel.stats.find((row) => row.id === 'run-a')?.subRank, undefined);
    assert.equal(readModel.stats.find((row) => row.id === 'run-b')?.subRank, undefined);
    assert.notEqual(readModel.stats.find((row) => row.id === 'run-a')?.rank, undefined);
  });
});

function defaultOptions(): ComparisonViewReadModelOptions {
  return {
    featureString: 'N M',
    xAxis: 'seed',
    yAxis: 'absScore',
    skipFailed: false,
    filter: '',
    bestRankingInclude: '',
    bestRankingExclude: '',
  };
}

function comparisonData(): ComparisonData {
  return {
    seeds: [0, 1, 2],
    inputData: {
      0: '1 10',
      1: '1 20',
      2: '2 30',
    },
    stderrData: {
      e1: {
        0: { width: 10 },
        1: { width: 5 },
        2: { width: 30 },
      },
      e2: {
        0: { width: 11 },
        1: { width: 6 },
        2: { width: 31 },
      },
    },
    results: [
      {
        id: 'e1',
        time: 'base',
        cases: [
          { seed: 0, score: 10, relativeScore: 50, executionTime: 1 },
          { seed: 1, score: 0, relativeScore: 0, executionTime: 2 },
          { seed: 2, score: 30, relativeScore: 100, executionTime: 3 },
        ],
      },
      {
        id: 'e2',
        time: 'next',
        cases: [
          { seed: 0, score: 20, relativeScore: 100, executionTime: 1 },
          { seed: 1, score: 5, relativeScore: 100, executionTime: 2 },
          { seed: 2, score: 30, relativeScore: 100, executionTime: 3 },
        ],
      },
    ],
    config: new ComparisonConfig('N M', 'N', 'avg(absScore)', 'line', true, ''),
    rankingPool: [
      {
        id: 'e1',
        comment: '',
        cases: [
          { seed: 0, score: 10 },
          { seed: 1, score: 0 },
          { seed: 2, score: 30 },
        ],
      },
      {
        id: 'e2',
        comment: '',
        cases: [
          { seed: 0, score: 20 },
          { seed: 1, score: 5 },
          { seed: 2, score: 30 },
        ],
      },
    ],
    objective: 'max',
  };
}
