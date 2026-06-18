import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import { BestScoreCalculator } from '../domain/services/bestScoreCalculator';
import { RelativeScoreCalculator } from '../domain/services/relativeScoreCalculator';
import type { ComparisonConfig } from './dtos/comparisonConfig';
import type { ComparisonData } from './dtos/comparisonData';
import type { IComparisonConfigRepository } from './repositories/IComparisonConfigRepository';

/**
 * 比較ビューに渡す read model を準備するユースケース。
 */
export class LoadComparisonDataUseCase {
  constructor(
    private executionRepository: IExecutionRepository,
    private testCaseRepository: ITestCaseRepository,
    private comparisonConfigRepository: IComparisonConfigRepository,
    private pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  async load(executionIds: string[]): Promise<ComparisonData | undefined> {
    const executions = (
      await Promise.all(
        executionIds.map(async (executionId) => {
          try {
            return await this.executionRepository.findById(executionId);
          } catch (error) {
            console.error(`Failed to load execution ${executionId}:`, error);
            return undefined;
          }
        }),
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
    const seeds = Array.from(new Set(testCases.map((testCase) => testCase.id.seed))).sort(
      (a, b) => a - b,
    );

    const inputData: Record<number, string> = {};
    const stderrData: Record<string, Record<number, Record<string, number>>> = {};

    for (const execution of executions) {
      stderrData[execution.id] = {};
      const executionTestCases = testCases.filter(
        (testCase) => testCase.id.executionId === execution.id,
      );

      for (const testCase of executionTestCases) {
        const seed = testCase.id.seed;
        inputData[seed] ??= testCase.firstInputLine || '';
        stderrData[execution.id][seed] = testCase.stderrVars || {};
      }
    }

    const config = await this.comparisonConfigRepository.find();
    const results = executions.map((execution) => ({
      id: execution.id,
      time: execution.getLongTitle(),
      cases: testCases
        .filter((testCase) => testCase.id.executionId === execution.id)
        .map((testCase) => {
          const bestScore = bestScores.get(testCase.id.seed);
          const relativeScore = RelativeScoreCalculator.calculate(
            testCase.score,
            bestScore,
            pahcerConfig.objective,
          );

          return {
            seed: testCase.id.seed,
            score: testCase.score,
            relativeScore,
            executionTime: testCase.executionTime,
          };
        }),
    }));

    return {
      results,
      seeds,
      inputData,
      stderrData,
      config,
    };
  }

  async saveConfig(config: ComparisonConfig): Promise<void> {
    await this.comparisonConfigRepository.upsert(config);
  }
}
