import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import { ComparisonConfig } from '../../src/application/dtos/comparisonConfig';
import { LoadComparisonDataUseCase } from '../../src/application/loadComparisonDataUseCase';
import type { IComparisonConfigRepository } from '../../src/application/repositories/IComparisonConfigRepository';
import type { IExecutionRepository } from '../../src/domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../../src/domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../../src/domain/interfaces/ITestCaseRepository';
import { type ConfigId, PahcerConfig } from '../../src/domain/models/configFile';
import { Execution } from '../../src/domain/models/execution';
import { TestCase, TestCaseId } from '../../src/domain/models/testCase';

describe('LoadComparisonDataUseCase', () => {
  it('builds comparison read model from execution ids', async () => {
    const executions = [
      new Execution('20260101010101', dayjs('2026-01-01T01:01:01'), 'base', null),
      new Execution('20260102020202', dayjs('2026-01-02T02:02:02'), 'next', null),
    ];
    const testCases = [
      testCase('20260101010101', 0, 10, 1.2, 'N=1', { width: 10 }),
      testCase('20260101010101', 1, 0, 2.5, 'N=2', { width: 20 }),
      testCase('20260102020202', 0, 20, 1.1, 'N=1', { width: 11 }),
      testCase('20260102020202', 1, 5, 2.0, 'N=2', { width: 21 }),
    ];
    const config = new ComparisonConfig('N', 'seed', 'avg(relativeScore)', 'line', '');

    const useCase = new LoadComparisonDataUseCase(
      new InMemoryExecutionRepository(executions),
      new InMemoryTestCaseRepository(testCases),
      new InMemoryComparisonConfigRepository(config),
      new FixedPahcerConfigRepository('max'),
    );

    const data = await useCase.load(['20260102020202', '20260101010101']);

    assert.ok(data);
    assert.deepEqual(data.seeds, [0, 1]);
    assert.equal(data.config, config);
    assert.deepEqual(data.inputData, { 0: 'N=1', 1: 'N=2' });
    assert.deepEqual(data.stderrData['20260101010101'][0], { width: 10 });
    assert.equal(data.results[0].id, '20260102020202');
    assert.equal(data.results[0].cases[0].relativeScore, 100);
    assert.equal(data.results[1].cases[0].relativeScore, 50);
    assert.equal(data.results[1].cases[1].relativeScore, 0);
  });

  it('returns undefined when no execution can be loaded', async () => {
    const useCase = new LoadComparisonDataUseCase(
      new InMemoryExecutionRepository([]),
      new InMemoryTestCaseRepository([]),
      new InMemoryComparisonConfigRepository(new ComparisonConfig()),
      new FixedPahcerConfigRepository('max'),
    );

    assert.equal(await useCase.load(['missing']), undefined);
  });
});

function testCase(
  executionId: string,
  seed: number,
  score: number,
  executionTime: number,
  firstInputLine: string,
  stderrVars: Record<string, number>,
): TestCase {
  return new TestCase(
    new TestCaseId(executionId, seed),
    score,
    executionTime,
    '',
    true,
    firstInputLine,
    stderrVars,
  );
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

class InMemoryComparisonConfigRepository implements IComparisonConfigRepository {
  constructor(private readonly config: ComparisonConfig) {}

  async find(): Promise<ComparisonConfig> {
    return this.config;
  }

  async upsert(_config: ComparisonConfig): Promise<void> {}
}

class FixedPahcerConfigRepository implements IPahcerConfigRepository {
  constructor(private readonly objective: 'max' | 'min') {}

  async findById(_id: ConfigId): Promise<PahcerConfig | undefined> {
    return new PahcerConfig('normal', 'pahcer_config.toml', 'problem', 0, 1, this.objective);
  }

  async upsert(_config: PahcerConfig): Promise<void> {}

  async delete(_id: ConfigId): Promise<void> {}
}
