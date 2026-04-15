import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import { type TestCase, TestCaseId } from '../domain/models/testCase';
import { BestScoreCalculator } from '../domain/services/bestScoreCalculator';
import { ExecutionStatsCalculator } from '../domain/services/executionStatsAggregator';
import { PahcerTreeData } from './dtos/pahcerTreeData';
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

  /**
   * Seedノード展開時に必要なテストケースを1件取得する（Tree表示用）
   */
  async loadTestCaseForTree(executionId: string, seed: number): Promise<TestCase | undefined> {
    return this.testCaseRepository.findById(new TestCaseId(executionId, seed));
  }
}
