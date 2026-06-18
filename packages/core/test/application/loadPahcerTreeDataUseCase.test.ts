import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import { ResourceNotFoundError } from '../../src/application/exceptions';
import { LoadPahcerTreeDataUseCase } from '../../src/application/loadPahcerTreeDataUseCase';
import type { ITestCaseSummaryQueryService } from '../../src/application/queryServices/testCaseSummaryQueryService';
import type { IExecutionRepository } from '../../src/domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../../src/domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../../src/domain/interfaces/ITestCaseRepository';
import { type ConfigId, PahcerConfig } from '../../src/domain/models/configFile';
import { Execution } from '../../src/domain/models/execution';
import { TestCase, TestCaseId } from '../../src/domain/models/testCase';

describe('LoadPahcerTreeDataUseCase', () => {
  it('builds tree-specific read model without presentation objects', async () => {
    const executions = [
      new Execution('20260101010101', dayjs('2026-01-01T01:01:01'), 'base', 'v1', 'abcdef123'),
      new Execution('20260102020202', dayjs('2026-01-02T02:02:02'), 'next', null),
    ];
    const detailedCases = [
      testCase('20260101010101', 0, 10, 1.2),
      testCase('20260101010101', 1, 0, 2.5),
      testCase('20260102020202', 0, 20, 1.1),
      testCase('20260102020202', 1, 5, 2.0),
    ];
    const summaryCases = detailedCases.map((testCase) => ({
      executionId: testCase.id.executionId,
      seed: testCase.id.seed,
      score: testCase.score,
      executionTime: testCase.executionTime,
      errorMessage: testCase.errorMessage,
    }));

    const useCase = new LoadPahcerTreeDataUseCase(
      new InMemoryExecutionRepository(executions),
      new InMemoryTestCaseRepository(detailedCases),
      new InMemoryTestCaseSummaryQueryService(summaryCases),
      new FixedPahcerConfigRepository('max'),
    );

    const treeData = await useCase.load();

    assert.deepEqual(
      treeData.executions.map((execution) => execution.id),
      ['20260101010101', '20260102020202'],
    );
    assert.equal(treeData.executions[0].titleWithHash, '01/01 01:01@abcdef1');
    assert.equal(treeData.bestScores.get(0), 20);
    assert.equal(treeData.bestScores.get(1), 5);
    assert.deepEqual(treeData.executionStatsList[0].waSeeds, [1]);
    assert.equal(treeData.executionStatsList[0].averageRelativeScore, 25);

    const cases = await useCase.loadCasesForExecution(
      treeData,
      '20260101010101',
      'relativeScoreDesc',
    );

    assert.ok(cases);
    assert.deepEqual(
      cases.cases.map((testCase) => testCase.testCase.seed),
      [0, 1],
    );
    assert.equal(cases.cases[0].relativeScore, 50);
    assert.equal(cases.cases[1].relativeScore, 0);

    const seedExecutions = await useCase.loadExecutionsForSeed(treeData, 0, 'absoluteScoreDesc');

    assert.deepEqual(
      seedExecutions.map((execution) => execution.execution.id),
      ['20260102020202', '20260101010101'],
    );
    assert.equal(seedExecutions[0].isLatest, true);
    assert.equal(seedExecutions[1].relativeScore, 50);

    assert.deepEqual(
      useCase.loadSeeds(treeData).map((stats) => ({
        seed: stats.seed,
        count: stats.count,
        bestScore: stats.bestScore,
      })),
      [
        { seed: 0, count: 2, bestScore: 20 },
        { seed: 1, count: 2, bestScore: 5 },
      ],
    );
    assert.equal((await useCase.loadExecutionTestCasesForTree('20260101010101')).length, 2);
    assert.equal((await useCase.loadTestCaseForTree('20260101010101', 0))?.score, 10);
    assert.equal(await useCase.loadCasesForExecution(treeData, 'missing', 'seedAsc'), undefined);
    assert.deepEqual(await useCase.loadExecutionsForSeed(treeData, 999, 'executionAsc'), []);
  });

  it('fails when pahcer config is missing', async () => {
    const useCase = new LoadPahcerTreeDataUseCase(
      new InMemoryExecutionRepository([]),
      new InMemoryTestCaseRepository([]),
      new InMemoryTestCaseSummaryQueryService([]),
      new MissingPahcerConfigRepository(),
    );

    await assert.rejects(() => useCase.load(), ResourceNotFoundError);
  });
});

function testCase(
  executionId: string,
  seed: number,
  score: number,
  executionTime: number,
): TestCase {
  return new TestCase(new TestCaseId(executionId, seed), score, executionTime, '', true);
}

class InMemoryExecutionRepository implements IExecutionRepository {
  constructor(private readonly executions: Execution[]) {}

  async findById(executionId: string): Promise<Execution | undefined> {
    return this.executions.find((execution) => execution.id === executionId);
  }

  async findAll(): Promise<Execution[]> {
    return this.executions;
  }

  async upsert(_execution: Execution): Promise<void> {}
}

class InMemoryTestCaseRepository implements ITestCaseRepository {
  constructor(private readonly testCases: TestCase[]) {}

  async findById(id: TestCaseId): Promise<TestCase | undefined> {
    return this.testCases.find(
      (testCase) => testCase.id.executionId === id.executionId && testCase.id.seed === id.seed,
    );
  }

  async findByExecutionId(executionId: string): Promise<TestCase[]> {
    return this.testCases.filter((testCase) => testCase.id.executionId === executionId);
  }

  async upsert(_testCase: TestCase): Promise<void> {}
}

class InMemoryTestCaseSummaryQueryService implements ITestCaseSummaryQueryService {
  constructor(
    private readonly testCases: Array<{
      executionId: string;
      seed: number;
      score: number;
      executionTime: number;
      errorMessage: string;
    }>,
  ) {}

  async findByExecutionId(executionId: string) {
    return this.testCases.filter((testCase) => testCase.executionId === executionId);
  }
}

class FixedPahcerConfigRepository implements IPahcerConfigRepository {
  constructor(private readonly objective: 'max' | 'min') {}

  async findById(_id: ConfigId): Promise<PahcerConfig | undefined> {
    return new PahcerConfig('normal', 'pahcer_config.toml', 'problem', 0, 1, this.objective);
  }

  async upsert(_config: PahcerConfig): Promise<void> {}

  async delete(_id: ConfigId): Promise<void> {}
}

class MissingPahcerConfigRepository implements IPahcerConfigRepository {
  async findById(_id: ConfigId): Promise<PahcerConfig | undefined> {
    return undefined;
  }

  async upsert(_config: PahcerConfig): Promise<void> {}

  async delete(_id: ConfigId): Promise<void> {}
}
