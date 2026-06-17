import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import { type TestCase, TestCaseId } from '../domain/models/testCase';
import { BestScoreCalculator } from '../domain/services/bestScoreCalculator';
import { ExecutionStatsCalculator } from '../domain/services/executionStatsAggregator';
import { RelativeScoreCalculator } from '../domain/services/relativeScoreCalculator';
import { SeedExecutionSorter, type SeedSortOrder } from '../domain/services/seedExecutionSorter';
import { SeedStatsCalculator } from '../domain/services/seedStatsCalculator';
import { SeedStatsSorter } from '../domain/services/seedStatsSorter';
import { TestCaseGrouper } from '../domain/services/testCaseGrouper';
import { type ExecutionSortOrder, TestCaseSorter } from '../domain/services/testCaseSorter';
import {
  PahcerTreeData,
  type TreeExecutionCases,
  type TreeSeedExecution,
  type TreeSeedStats,
} from './dtos/pahcerTreeData';
import { ResourceNotFoundError } from './exceptions';
import type { ITestCaseSummaryQueryService } from './queryServices/testCaseSummaryQueryService';

/**
 * TreeView表示用データを準備するユースケース
 *
 * 責務:
 * - 実行結果、設定、軽量テストケースを読み込み
 * - ドメインサービスでベストスコアと実行統計を計算
 * - TreeView表示に必要なデータを集約して返す
 *
 * フロー:
 * 1. 実行結果（Execution）を全件取得
 * 2. pahcer設定を取得
 * 3. 各実行のテストケースを軽量読み込み（メタデータや出力存在確認は行わない）
 * 4. ベストスコアを計算（ドメインサービス）
 * 5. 実行統計を計算（ドメインサービス）
 * 6. PahcerTreeData として返す
 */
export class LoadPahcerTreeDataUseCase {
  constructor(
    private executionRepository: IExecutionRepository,
    private testCaseRepository: ITestCaseRepository,
    private testCaseSummaryQueryService: ITestCaseSummaryQueryService,
    private pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  /**
   * TreeView表示用データを読み込む
   *
   * @returns PahcerTreeData - TreeView表示に必要な計算済みデータ
   * @throws ResourceNotFoundError - pahcer設定が見つからない場合
   */
  async load(): Promise<PahcerTreeData> {
    // 実行結果を全件取得
    const executions = await this.executionRepository.findAll();

    // pahcer設定を取得
    const config = await this.pahcerConfigRepository.findById('normal');
    if (!config) {
      throw new ResourceNotFoundError('pahcer 設定');
    }

    // Root表示用に軽量テストケースを読み込む
    const testCasesByExecution = await Promise.all(
      executions.map((execution) =>
        this.testCaseSummaryQueryService.findByExecutionId(execution.id),
      ),
    );
    const allTestCases = testCasesByExecution.flat();

    // ベストスコアを計算
    const bestScores = BestScoreCalculator.calculate(allTestCases, config.objective);

    // 実行統計を計算
    const executionStatsList = ExecutionStatsCalculator.calculate(
      executions,
      allTestCases,
      bestScores,
      config.objective,
    );

    return new PahcerTreeData(executions, allTestCases, config, bestScores, executionStatsList);
  }

  /**
   * 実行ノード展開時に必要なテストケースを取得する（Tree表示用）
   */
  async loadExecutionTestCasesForTree(executionId: string): Promise<TestCase[]> {
    return this.testCaseRepository.findByExecutionId(executionId);
  }

  async loadCasesForExecution(
    treeData: PahcerTreeData,
    executionId: string,
    sortOrder: ExecutionSortOrder,
  ): Promise<TreeExecutionCases | undefined> {
    const executionStats = treeData.executionStatsList.find(
      (stats) => stats.execution.id === executionId,
    );
    if (!executionStats) {
      return undefined;
    }

    const detailedCases = await this.testCaseRepository.findByExecutionId(executionId);
    const relativeScores = this.calculateRelativeScores(treeData, detailedCases);
    const sortedCases = TestCaseSorter.byOrder(detailedCases, sortOrder, relativeScores);

    return {
      executionStats,
      cases: sortedCases.map((testCase) => ({
        testCase,
        relativeScore: relativeScores.get(testCase.id.seed) ?? 100,
      })),
    };
  }

  loadSeeds(treeData: PahcerTreeData): TreeSeedStats[] {
    const statsMap = SeedStatsCalculator.calculate(treeData.testCases, treeData.bestScores);
    return SeedStatsSorter.bySeedAscending(statsMap);
  }

  async loadExecutionsForSeed(
    treeData: PahcerTreeData,
    seed: number,
    sortOrder: SeedSortOrder,
  ): Promise<TreeSeedExecution[]> {
    const grouped = TestCaseGrouper.bySeed(treeData.testCases, treeData.executions);
    const seedGroup = grouped.find((group) => group.seed === seed);
    if (!seedGroup) {
      return [];
    }

    const executionDataWithOutput = (
      await Promise.all(
        seedGroup.executions.map(async (executionData) => {
          const detailedTestCase = await this.loadTestCaseForTree(executionData.execution.id, seed);
          if (!detailedTestCase) {
            return undefined;
          }
          return {
            execution: executionData.execution,
            testCase: detailedTestCase,
          };
        }),
      )
    ).filter((value): value is Omit<TreeSeedExecution, 'relativeScore' | 'isLatest'> => {
      return value !== undefined;
    });

    const latestExecutionId = [...executionDataWithOutput].sort((a, b) =>
      b.execution.id.localeCompare(a.execution.id),
    )[0]?.execution.id;
    const sortedExecutions = SeedExecutionSorter.byOrder(executionDataWithOutput, sortOrder);

    return sortedExecutions.map((executionData) => {
      const bestScore = treeData.bestScores.get(seed);
      const relativeScore = RelativeScoreCalculator.calculate(
        executionData.testCase.score,
        bestScore,
        treeData.config.objective,
      );

      return {
        ...executionData,
        relativeScore,
        isLatest:
          executionData.execution.id === latestExecutionId &&
          (sortOrder === 'absoluteScoreAsc' || sortOrder === 'absoluteScoreDesc'),
      };
    });
  }

  /**
   * Seedノード展開時に必要なテストケースを1件取得する（Tree表示用）
   */
  async loadTestCaseForTree(executionId: string, seed: number): Promise<TestCase | undefined> {
    return this.testCaseRepository.findById(new TestCaseId(executionId, seed));
  }

  private calculateRelativeScores(
    treeData: PahcerTreeData,
    testCases: TestCase[],
  ): Map<number, number> {
    const relativeScores = new Map<number, number>();

    for (const testCase of testCases) {
      const bestScore = treeData.bestScores.get(testCase.id.seed);
      const relativeScore = RelativeScoreCalculator.calculate(
        testCase.score,
        bestScore,
        treeData.config.objective,
      );
      relativeScores.set(testCase.id.seed, relativeScore);
    }

    return relativeScores;
  }
}
