import * as vscode from 'vscode';
import { type Execution, getShortTitle } from '../../domain/models/execution';
import type { TestCase } from '../../domain/models/testCase';
import {
	calculateBestScoresFromTestCases,
	calculateSeedStats,
} from '../../domain/services/aggregationService';
import {
	aggregateByExecution,
	type ExecutionStats,
} from '../../domain/services/executionAggregationService';
import { groupBySeed } from '../../domain/services/groupingService';
import type {
	ExecutionSortOrder,
	GroupingMode,
	SeedSortOrder,
} from '../../domain/services/sortingService';
import { sortExecutionsForSeed, sortTestCases } from '../../domain/services/sortingService';
import { ExecutionRepository } from '../../infrastructure/executionRepository';
import { PahcerAdapter, PahcerStatus } from '../../infrastructure/pahcerAdapter';
import { PahcerConfigRepository } from '../../infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from '../../infrastructure/testCaseRepository';
import { TreeItemBuilder } from '../view/treeView/treeItemBuilder';

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
	executionStats?: ExecutionStats;
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

	private pahcerAdapter: PahcerAdapter;
	private executionRepository: ExecutionRepository;
	private testCaseRepository: TestCaseRepository;
	private pahcerConfigRepository: PahcerConfigRepository;
	private treeItemBuilder: TreeItemBuilder;
	private readonly CONFIG_SECTION = 'pahcer-ui';

	// Cache for reuse across method calls
	private cachedBestScores?: Map<number, number>;
	private cachedTestCases?: TestCase[];

	constructor(workspaceRoot: string) {
		const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
		this.pahcerAdapter = new PahcerAdapter(pahcerConfigRepository, workspaceRoot);
		this.executionRepository = new ExecutionRepository(workspaceRoot);
		this.testCaseRepository = new TestCaseRepository(workspaceRoot);
		this.pahcerConfigRepository = pahcerConfigRepository;
		this.treeItemBuilder = new TreeItemBuilder();
	}

	/**
	 * TreeViewをリフレッシュ
	 */
	refresh(): void {
		// Clear cache on refresh
		this.cachedBestScores = undefined;
		this.cachedTestCases = undefined;
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * グルーピングモードを設定
	 */
	async setGroupingMode(mode: GroupingMode): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('groupingMode', mode, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	/**
	 * グルーピングモードを取得
	 */
	getGroupingMode(): GroupingMode {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<GroupingMode>('groupingMode') || 'byExecution';
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
	 * 実行ごとのソート順を設定
	 */
	async setExecutionSortOrder(order: ExecutionSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('executionSortOrder', order, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	/**
	 * 実行ごとのソート順を取得
	 */
	getExecutionSortOrder(): ExecutionSortOrder {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<ExecutionSortOrder>('executionSortOrder') || 'seedAsc';
	}

	/**
	 * Seedごとのソート順を設定
	 */
	async setSeedSortOrder(order: SeedSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('seedSortOrder', order, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	/**
	 * Seedごとのソート順を取得
	 */
	getSeedSortOrder(): SeedSortOrder {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<SeedSortOrder>('seedSortOrder') || 'executionDesc';
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

		const groupingMode = this.getGroupingMode();

		if (groupingMode === 'byExecution') {
			return this.getChildrenByExecution(element);
		} else {
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
		// Load executions and test cases
		const executions = await this.executionRepository.getAll();
		const testCases = await this.testCaseRepository.loadAllTestCases();
		const config = await this.pahcerConfigRepository.get('normal');

		if (executions.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		// Calculate best scores
		const bestScores = calculateBestScoresFromTestCases(testCases, config.objective);

		// Aggregate by execution
		const executionStatsList = aggregateByExecution(
			executions,
			testCases,
			bestScores,
			config.objective,
		);

		// Cache for reuse
		this.cachedBestScores = bestScores;
		this.cachedTestCases = testCases;

		const items: PahcerTreeItem[] = [];

		for (const executionStats of executionStatsList) {
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
	}

	/**
	 * 実行結果のテストケース一覧を取得
	 */
	private async getCasesForExecution(executionStats: ExecutionStats): Promise<PahcerTreeItem[]> {
		const items: PahcerTreeItem[] = [];

		// Ensure bestScores are loaded
		if (!this.cachedBestScores) {
			const testCases = await this.testCaseRepository.loadAllTestCases();
			const config = await this.pahcerConfigRepository.get('normal');
			this.cachedBestScores = calculateBestScoresFromTestCases(testCases, config.objective);
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

		// Calculate relative scores for each test case
		const relativeScores = new Map<number, number>();
		const config = await this.pahcerConfigRepository.get('normal');
		for (const testCase of executionStats.testCases) {
			const bestScore = this.cachedBestScores.get(testCase.seed);
			if (bestScore !== undefined && testCase.score > 0) {
				if (config.objective === 'max') {
					relativeScores.set(testCase.seed, (testCase.score / bestScore) * 100);
				} else {
					relativeScores.set(testCase.seed, (bestScore / testCase.score) * 100);
				}
			} else {
				relativeScores.set(testCase.seed, 0);
			}
		}

		// Sort cases
		const sortOrder = this.getExecutionSortOrder();
		const sortedCases = sortTestCases(executionStats.testCases, sortOrder, relativeScores);

		// Cases
		for (const testCase of sortedCases) {
			const relativeScore = relativeScores.get(testCase.seed) ?? 100;
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
			item.seed = testCase.seed;
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
		// Load test cases
		const testCases = await this.testCaseRepository.loadAllTestCases();

		if (testCases.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		// Calculate best scores and seed stats
		const config = await this.pahcerConfigRepository.get('normal');
		const bestScores = calculateBestScoresFromTestCases(testCases, config.objective);
		const statsMap = calculateSeedStats(testCases, bestScores);

		// Cache for reuse
		this.cachedBestScores = bestScores;
		this.cachedTestCases = testCases;

		const items: PahcerTreeItem[] = [];

		for (const stats of Array.from(statsMap.values()).sort((a, b) => a.seed - b.seed)) {
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
	}

	/**
	 * Seedの実行結果一覧を取得
	 */
	private async getExecutionsForSeed(seed: number): Promise<PahcerTreeItem[]> {
		// Load test cases and executions if not cached
		if (!this.cachedTestCases) {
			this.cachedTestCases = await this.testCaseRepository.loadAllTestCases();
		}
		const executions = (await this.executionRepository.getAll()).sort((a, b) =>
			b.startTime.diff(a.startTime),
		);
		const config = await this.pahcerConfigRepository.get('normal');

		// Ensure bestScores are calculated
		if (!this.cachedBestScores) {
			this.cachedBestScores = calculateBestScoresFromTestCases(
				this.cachedTestCases,
				config.objective,
			);
		}

		// Group by seed
		const grouped = groupBySeed(this.cachedTestCases, executions);
		const seedGroup = grouped.find((g) => g.seed === seed);

		if (!seedGroup) {
			return [];
		}

		// Sort executions
		const sortOrder = this.getSeedSortOrder();
		const sortedExecutions = sortExecutionsForSeed(seedGroup.executions, sortOrder);

		// Find latest execution
		const latestExecutionId = [...seedGroup.executions].sort((a, b) =>
			b.execution.id.localeCompare(a.execution.id),
		)[0]?.execution.id;

		const items: PahcerTreeItem[] = [];

		for (const executionData of sortedExecutions) {
			const time = getShortTitle(executionData.execution);
			const isLatest =
				executionData.execution.id === latestExecutionId &&
				(sortOrder === 'absoluteScoreAsc' || sortOrder === 'absoluteScoreDesc');

			// Calculate relative score
			const bestScore = this.cachedBestScores.get(seed);
			let relativeScore = 0;
			if (bestScore !== undefined && executionData.testCase.score > 0) {
				if (config.objective === 'max') {
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
	}

	/**
	 * コミットハッシュを持つチェック済み結果を取得
	 */
	async getCheckedResultsWithCommitHash(): Promise<Execution[]> {
		const results: Execution[] = [];
		for (const executionId of this.checkedResults) {
			const execution = await this.executionRepository.get(executionId);
			if (execution?.commitHash) {
				results.push(execution);
			}
		}
		return results;
	}
}
