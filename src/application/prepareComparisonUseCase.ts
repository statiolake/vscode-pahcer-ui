import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import type { IUIConfigRepository } from '../domain/interfaces/IUIConfigRepository';
import { BestScoreCalculator } from '../domain/services/bestScoreCalculator';
import { RelativeScoreCalculator } from '../domain/services/relativeScoreCalculator';

export class PrepareComparisonUseCase {
  constructor(
    private readonly executionRepository: IExecutionRepository,
    private readonly testCaseRepository: ITestCaseRepository,
    private readonly uiConfigRepository: IUIConfigRepository,
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  async execute(executionIds: string[]) {
    const executions = (
      await Promise.all(
        executionIds.map((executionId) => this.executionRepository.findById(executionId)),
      )
    ).filter((execution) => execution !== undefined);

    if (executions.length === 0) {
      return undefined;
    }

    const testCasesArray = await Promise.all(
      executions.map((execution) => this.testCaseRepository.findByExecutionId(execution.id)),
    );
    const testCases = testCasesArray.flat();
    const pahcerConfig = await this.pahcerConfigRepository.findById('normal');
    if (!pahcerConfig) {
      throw new Error('pahcer設定が見つかりません');
    }

    const bestScores = BestScoreCalculator.calculate(testCases, pahcerConfig.objective);
    const allSeeds = new Set<number>();
    for (const testCase of testCases) {
      allSeeds.add(testCase.id.seed);
    }
    const seeds = Array.from(allSeeds).sort((a, b) => a - b);

    const inputData: Record<number, string> = {};
    const stderrData: Record<string, Record<number, Record<string, number>>> = {};

    for (const execution of executions) {
      stderrData[execution.id] = {};
      const executionTestCases = testCases.filter(
        (testCase) => testCase.id.executionId === execution.id,
      );

      for (const testCase of executionTestCases) {
        const seed = testCase.id.seed;
        if (testCase.firstInputLine !== undefined && inputData[seed] === undefined) {
          inputData[seed] = testCase.firstInputLine || '';
        }
        if (inputData[seed] === undefined) {
          inputData[seed] = '';
        }
        stderrData[execution.id][seed] = testCase.stderrVars || {};
      }
    }

    const config = await this.uiConfigRepository.find();
    const results = executions.map((execution) => ({
      id: execution.id,
      time: execution.getLongTitle(),
      cases: testCases
        .filter((testCase) => testCase.id.executionId === execution.id)
        .map((testCase) => ({
          seed: testCase.id.seed,
          score: testCase.score,
          relativeScore: RelativeScoreCalculator.calculate(
            testCase.score,
            bestScores.get(testCase.id.seed),
            pahcerConfig.objective,
          ),
          executionTime: testCase.executionTime,
        })),
    }));

    return {
      results,
      seeds,
      inputData,
      stderrData,
      config,
    };
  }
}
