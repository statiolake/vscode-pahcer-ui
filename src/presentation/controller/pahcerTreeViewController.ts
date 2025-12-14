import * as vscode from 'vscode';
import type { LoadPahcerTreeDataUseCase } from '../../application/loadPahcerTreeDataUseCase';
import { PahcerStatus } from '../../domain/interfaces';
import type { IExecutionRepository } from '../../domain/interfaces/IExecutionRepository';
import type { IPahcerAdapter } from '../../domain/interfaces/IPahcerAdapter';
import type { Execution } from '../../domain/models/execution';
import type { TreeData } from '../../domain/models/treeData';
import type { ExecutionStatsCalculator } from '../../domain/services/executionStatsAggregator';
import { RelativeScoreCalculator } from '../../domain/services/relativeScoreCalculator';
import { SeedExecutionSorter } from '../../domain/services/seedExecutionSorter';
import { SeedStatsCalculator } from '../../domain/services/seedStatsCalculator';
import { SeedStatsSorter } from '../../domain/services/seedStatsSorter';
import { TestCaseGrouper } from '../../domain/services/testCaseGrouper';
import { TestCaseSorter } from '../../domain/services/testCaseSorter';
import type { AppUIConfig } from '../appUIConfig';
import type { TreeItemBuilder } from '../view/treeView/treeItemBuilder';

/**
 * TreeItem with metadata
 */
export class PahcerTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'execution' | 'case' | 'seed' | 'summary' | 'info',
    description?: string,
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.contextValue = itemType;
  }

  executionId?: string;
  executionStats?: ExecutionStatsCalculator.ExecutionStats;
  seed?: number;
  comment?: string;
}

/**
 * Pahcer結果のTreeViewコントローラ
 */
export class PahcerTreeViewController implements vscode.TreeDataProvider<PahcerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PahcerTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private checkedResults = new Set<string>();

  // Cache for reuse across method calls
  private cachedTreeData?: TreeData;

  constructor(
    private readonly appConfig: AppUIConfig,
    private readonly pahcerAdapter: IPahcerAdapter,
    private readonly loadTreeDataUseCase: LoadPahcerTreeDataUseCase,
    private readonly executionRepository: IExecutionRepository,
    private readonly treeItemBuilder: TreeItemBuilder,
  ) {}

  /**
   * TreeViewをリフレッシュ
   */
  refresh(): void {
    // Clear cache on refresh
    this.cachedTreeData = undefined;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * チェックされた結果を取得
   */
  getCheckedResults(): string[] {
    return Array.from(this.checkedResults);
  }

  /**
   * チェックボックスをトグル
   */
  toggleCheckbox(resultId: string): void {
    if (this.checkedResults.has(resultId)) {
      this.checkedResults.delete(resultId);
    } else {
      this.checkedResults.add(resultId);
    }
  }

  /**
   * TreeItemを取得
   */
  getTreeItem(element: PahcerTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 子要素を取得
   */
  async getChildren(element?: PahcerTreeItem): Promise<PahcerTreeItem[]> {
    // Check pahcer status
    const status = await this.pahcerAdapter.checkStatus();

    // If not ready, return empty array to show welcome view
    if (status !== PahcerStatus.Ready) {
      return [];
    }

    const groupingMode = await this.appConfig.groupingMode();

    switch (groupingMode) {
      case 'byExecution':
        return this.getChildrenByExecution(element);
      case 'bySeed':
        return this.getChildrenBySeed(element);
    }
  }

  /**
   * 実行ごとモードの子要素を取得
   */
  private async getChildrenByExecution(element?: PahcerTreeItem): Promise<PahcerTreeItem[]> {
    if (!element) {
      // Root level: show all results
      return this.getExecutions();
    } else if (element.itemType === 'execution' && element.executionStats) {
      // Show cases for a result
      return this.getCasesForExecution(element.executionStats);
    } else {
      return [];
    }
  }

  /**
   * Seedごとモードの子要素を取得
   */
  private async getChildrenBySeed(element?: PahcerTreeItem): Promise<PahcerTreeItem[]> {
    if (!element) {
      // Root level: show all seeds
      return this.getSeeds();
    } else if (element.itemType === 'seed' && element.seed !== undefined) {
      // Show executions for a seed
      return this.getExecutionsForSeed(element.seed);
    } else {
      return [];
    }
  }

  /**
   * 実行結果一覧を取得
   */
  private async getExecutions(): Promise<PahcerTreeItem[]> {
    // TreeData をユースケースから取得
    try {
      const treeData = await this.loadTreeDataUseCase.load();

      // キャッシュに保存（他のメソッドから再利用）
      this.cachedTreeData = treeData;

      if (treeData.executions.length === 0) {
        const item = new PahcerTreeItem(
          'No results found',
          vscode.TreeItemCollapsibleState.None,
          'info',
        );
        return [item];
      }

      const items: PahcerTreeItem[] = [];

      for (const executionStats of treeData.executionStatsList) {
        // Build tree item
        const builtItem = this.treeItemBuilder.buildExecutionItem(
          executionStats,
          true, // Always show checkbox
          this.checkedResults.has(executionStats.execution.id),
        );

        const item = new PahcerTreeItem(
          builtItem.label as string,
          builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
          'execution',
          builtItem.description as string,
        );
        item.executionId = executionStats.execution.id;
        item.executionStats = executionStats;
        item.checkboxState = builtItem.checkboxState;
        item.iconPath = builtItem.iconPath;

        items.push(item);
      }

      return items;
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('pahcer設定')
          ? 'pahcer設定が見つかりません'
          : 'データの読み込みに失敗しました';
      const item = new PahcerTreeItem(message, vscode.TreeItemCollapsibleState.None, 'info');
      return [item];
    }
  }

  /**
   * 実行結果のテストケース一覧を取得
   */
  private async getCasesForExecution(
    executionStats: ExecutionStatsCalculator.ExecutionStats,
  ): Promise<PahcerTreeItem[]> {
    const items: PahcerTreeItem[] = [];

    // TreeData をユースケースから取得（キャッシュ）
    let treeData = this.cachedTreeData;
    if (!treeData) {
      try {
        treeData = await this.loadTreeDataUseCase.load();
        this.cachedTreeData = treeData;
      } catch (error) {
        const message =
          error instanceof Error && error.message.includes('pahcer設定')
            ? 'pahcer設定が見つかりません'
            : 'データの読み込みに失敗しました';
        const item = new PahcerTreeItem(message, vscode.TreeItemCollapsibleState.None, 'info');
        return [item];
      }
    }

    // Summary
    const summaryBuilt = this.treeItemBuilder.buildSummaryItem(executionStats);
    const summaryItem = new PahcerTreeItem(
      summaryBuilt.label as string,
      summaryBuilt.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
      'summary',
    );
    summaryItem.iconPath = summaryBuilt.iconPath;
    items.push(summaryItem);

    // Calculate relative scores for each test case using domain service
    const relativeScores = new Map<number, number>();
    for (const testCase of executionStats.testCases) {
      const bestScore = treeData.bestScores.get(testCase.id.seed);
      const relativeScore = RelativeScoreCalculator.calculate(
        testCase.score,
        bestScore,
        treeData.config.objective,
      );
      relativeScores.set(testCase.id.seed, relativeScore);
    }

    // Sort cases
    const sortOrder = await this.appConfig.executionSortOrder();
    const sortedCases = TestCaseSorter.byOrder(executionStats.testCases, sortOrder, relativeScores);

    // Cases
    for (const testCase of sortedCases) {
      const relativeScore = relativeScores.get(testCase.id.seed) ?? 100;
      const builtItem = this.treeItemBuilder.buildTestCaseItem(
        testCase,
        relativeScore,
        executionStats.execution.id,
      );
      const item = new PahcerTreeItem(
        builtItem.label as string,
        builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
        'case',
        builtItem.description as string,
      );
      item.seed = testCase.id.seed;
      item.executionId = executionStats.execution.id;
      item.command = builtItem.command;
      item.iconPath = builtItem.iconPath;
      item.tooltip = builtItem.tooltip;

      items.push(item);
    }

    return items;
  }

  /**
   * Seed一覧を取得
   */
  private async getSeeds(): Promise<PahcerTreeItem[]> {
    try {
      // TreeData をユースケースから取得（キャッシュ）
      let treeData = this.cachedTreeData;
      if (!treeData) {
        treeData = await this.loadTreeDataUseCase.load();
        this.cachedTreeData = treeData;
      }

      if (treeData.testCases.length === 0) {
        const item = new PahcerTreeItem(
          'No results found',
          vscode.TreeItemCollapsibleState.None,
          'info',
        );
        return [item];
      }

      const statsMap = SeedStatsCalculator.calculate(treeData.testCases, treeData.bestScores);

      const items: PahcerTreeItem[] = [];

      // Sort seed stats using domain service
      const sortedStats = SeedStatsSorter.bySeedAscending(statsMap);
      for (const stats of sortedStats) {
        const builtItem = this.treeItemBuilder.buildSeedItem(stats);
        const item = new PahcerTreeItem(
          builtItem.label as string,
          builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
          'seed',
          builtItem.description as string,
        );
        item.seed = stats.seed;
        item.iconPath = builtItem.iconPath;

        items.push(item);
      }

      return items;
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('pahcer設定')
          ? 'pahcer設定が見つかりません'
          : 'データの読み込みに失敗しました';
      const item = new PahcerTreeItem(message, vscode.TreeItemCollapsibleState.None, 'info');
      return [item];
    }
  }

  /**
   * Seedの実行結果一覧を取得
   */
  private async getExecutionsForSeed(seed: number): Promise<PahcerTreeItem[]> {
    try {
      // TreeData をユースケースから取得（キャッシュ）
      let treeData = this.cachedTreeData;
      if (!treeData) {
        treeData = await this.loadTreeDataUseCase.load();
        this.cachedTreeData = treeData;
      }

      // Group by seed
      const grouped = TestCaseGrouper.bySeed(treeData.testCases, treeData.executions);
      const seedGroup = grouped.find((g) => g.seed === seed);

      if (!seedGroup) {
        return [];
      }

      // Sort executions
      const sortOrder = await this.appConfig.seedSortOrder();
      const sortedExecutions = SeedExecutionSorter.byOrder(seedGroup.executions, sortOrder);

      // Find latest execution
      const latestExecutionId = [...seedGroup.executions].sort((a, b) =>
        b.execution.id.localeCompare(a.execution.id),
      )[0]?.execution.id;

      const items: PahcerTreeItem[] = [];

      for (const executionData of sortedExecutions) {
        const time = executionData.execution.getShortTitle();
        const isLatest =
          executionData.execution.id === latestExecutionId &&
          (sortOrder === 'absoluteScoreAsc' || sortOrder === 'absoluteScoreDesc');

        // Calculate relative score
        const bestScore = treeData.bestScores.get(seed);
        let relativeScore = 0;
        if (bestScore !== undefined && executionData.testCase.score > 0) {
          if (treeData.config.objective === 'max') {
            relativeScore = (executionData.testCase.score / bestScore) * 100;
          } else {
            relativeScore = (bestScore / executionData.testCase.score) * 100;
          }
        }

        const builtItem = this.treeItemBuilder.buildSeedExecutionItem(
          time,
          executionData.testCase,
          relativeScore,
          seed,
          executionData.execution.id,
          isLatest,
          true, // Show checkbox
          this.checkedResults.has(executionData.execution.id),
        );

        const item = new PahcerTreeItem(
          builtItem.label as string,
          builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
          'execution',
          builtItem.description as string,
        );
        item.seed = seed;
        item.executionId = executionData.execution.id;
        item.command = builtItem.command;
        item.checkboxState = builtItem.checkboxState;
        item.iconPath = builtItem.iconPath;
        item.tooltip = builtItem.tooltip;

        items.push(item);
      }

      return items;
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('pahcer設定')
          ? 'pahcer設定が見つかりません'
          : 'データの読み込みに失敗しました';
      const item = new PahcerTreeItem(message, vscode.TreeItemCollapsibleState.None, 'info');
      return [item];
    }
  }

  /**
   * コミットハッシュを持つチェック済み結果を取得
   */
  async getCheckedResultsWithCommitHash(): Promise<Execution[]> {
    const results: Execution[] = [];
    for (const executionId of this.checkedResults) {
      const execution = await this.executionRepository.findById(executionId);
      if (execution?.commitHash) {
        results.push(execution);
      }
    }
    return results;
  }
}
