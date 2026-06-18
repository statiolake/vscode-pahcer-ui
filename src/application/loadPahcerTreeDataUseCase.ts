import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import type { Execution } from '../domain/models/execution';
import { type TestCase, TestCaseId } from '../domain/models/testCase';
import { BestScoreCalculator } from '../domain/services/bestScoreCalculator';
import { ExecutionStatsCalculator } from '../domain/services/executionStatsAggregator';
import { RelativeScoreCalculator } from '../domain/services/relativeScoreCalculator';
import { SeedStatsCalculator } from '../domain/services/seedStatsCalculator';
import { SeedStatsSorter } from '../domain/services/seedStatsSorter';
import { TestCaseSorter } from '../domain/services/testCaseSorter';
import {
  PahcerTreeData,
  type TreeExecutionCases,
  type TreeExecutionStats,
  type TreeSeedExecution,
  type TreeSeedStats,
  type TreeTestCase,
  type TreeViewTestCaseSummary,
} from './dtos/pahcerTreeData';
import type { ExecutionSortOrder, SeedSortOrder } from './dtos/pahcerUIState';
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
    const caseLikes = allTestCases.map((testCase) => this.toCaseLike(testCase));

    // ベストスコアを計算
    const bestScores = BestScoreCalculator.calculate(caseLikes, config.objective);

    // 実行統計を計算
    const executionStatsList = ExecutionStatsCalculator.calculate(
      executions,
      caseLikes,
      bestScores,
      config.objective,
    );

    return new PahcerTreeData(
      executions.map((execution) => this.toTreeExecutionSummary(execution)),
      allTestCases,
      config.objective,
      bestScores,
      executionStatsList.map((stats) => this.toTreeExecutionStats(stats)),
    );
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
        testCase: this.toTreeTestCase(testCase),
        relativeScore: relativeScores.get(testCase.id.seed) ?? 100,
      })),
    };
  }

  loadSeeds(treeData: PahcerTreeData): TreeSeedStats[] {
    const statsMap = SeedStatsCalculator.calculate(
      treeData.testCases.map((testCase) => this.toCaseLike(testCase)),
      treeData.bestScores,
    );
    return SeedStatsSorter.bySeedAscending(statsMap).map((stats) => ({
      seed: stats.seed,
      count: stats.count,
      averageScore: stats.averageScore,
      averageRelativeScore: this.calculateAverageRelativeScore(
        stats.testCases.map((testCase) => testCase.id.seed),
        stats.testCases.map((testCase) => testCase.score),
        treeData.bestScores,
        treeData.objective,
      ),
      bestScore: stats.bestScore ?? 0,
    }));
  }

  async loadExecutionsForSeed(
    treeData: PahcerTreeData,
    seed: number,
    sortOrder: SeedSortOrder,
  ): Promise<TreeSeedExecution[]> {
    const executions = treeData.executions.filter((execution) =>
      treeData.testCases.some(
        (testCase) => testCase.seed === seed && testCase.executionId === execution.id,
      ),
    );
    if (executions.length === 0) {
      return [];
    }

    const executionDataWithOutput = (
      await Promise.all(
        executions.map(async (execution) => {
          const detailedTestCase = await this.loadTestCaseForTree(execution.id, seed);
          if (!detailedTestCase) {
            return undefined;
          }
          return {
            execution,
            testCase: detailedTestCase,
          };
        }),
      )
    ).filter((value): value is { execution: (typeof executions)[number]; testCase: TestCase } => {
      return value !== undefined;
    });

    const latestExecutionId = [...executionDataWithOutput].sort((a, b) =>
      b.execution.id.localeCompare(a.execution.id),
    )[0]?.execution.id;
    const sortedExecutions = this.sortSeedExecutions(executionDataWithOutput, sortOrder);

    return sortedExecutions.map((executionData) => {
      const bestScore = treeData.bestScores.get(seed);
      const relativeScore = RelativeScoreCalculator.calculate(
        executionData.testCase.score,
        bestScore,
        treeData.objective,
      );

      return {
        execution: executionData.execution,
        testCase: this.toTreeTestCase(executionData.testCase),
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
        treeData.objective,
      );
      relativeScores.set(testCase.id.seed, relativeScore);
    }

    return relativeScores;
  }

  private sortSeedExecutions<T extends { execution: { id: string }; testCase: { score: number } }>(
    executions: T[],
    order: SeedSortOrder,
  ): T[] {
    const sorted = [...executions];

    switch (order) {
      case 'executionAsc':
        sorted.sort((a, b) => a.execution.id.localeCompare(b.execution.id));
        break;
      case 'executionDesc':
        sorted.sort((a, b) => b.execution.id.localeCompare(a.execution.id));
        break;
      case 'absoluteScoreAsc':
        sorted.sort((a, b) => a.testCase.score - b.testCase.score);
        break;
      case 'absoluteScoreDesc':
        sorted.sort((a, b) => b.testCase.score - a.testCase.score);
        break;
    }

    return sorted;
  }

  private toTreeExecutionSummary(execution: Execution) {
    return {
      id: execution.id,
      shortTitle: execution.getShortTitle(),
      longTitle: execution.getLongTitle(),
      titleWithHash: execution.getTitleWithHash(),
      startTimeMillis: execution.startTime.valueOf(),
      comment: execution.comment,
      tagName: execution.tagName,
      commitHash: execution.commitHash,
    };
  }

  private toTreeExecutionStats(stats: ExecutionStatsCalculator.ExecutionStats): TreeExecutionStats {
    return {
      execution: this.toTreeExecutionSummary(stats.execution),
      caseCount: stats.caseCount,
      acCount: stats.acCount,
      totalScore: stats.totalScore,
      averageScore: stats.averageScore,
      averageRelativeScore: stats.averageRelativeScore,
      maxExecutionTime: stats.maxExecutionTime,
      waSeeds: stats.waSeeds,
    };
  }

  private toTreeTestCase(testCase: TestCase): TreeTestCase {
    return {
      executionId: testCase.id.executionId,
      seed: testCase.id.seed,
      score: testCase.score,
      executionTime: testCase.executionTime,
      errorMessage: testCase.errorMessage,
      foundOutput: testCase.foundOutput,
    };
  }

  private toCaseLike(testCase: TreeViewTestCaseSummary): ExecutionStatsCalculator.CaseLike {
    return {
      id: {
        executionId: testCase.executionId,
        seed: testCase.seed,
      },
      score: testCase.score,
      executionTime: testCase.executionTime,
    };
  }

  private calculateAverageRelativeScore(
    seeds: number[],
    scores: number[],
    bestScores: Map<number, number>,
    objective: 'max' | 'min',
  ): number {
    if (scores.length === 0) {
      return 0;
    }

    const total = scores.reduce(
      (sum, score, index) =>
        sum + RelativeScoreCalculator.calculate(score, bestScores.get(seeds[index]), objective),
      0,
    );

    return total / scores.length;
  }
}
