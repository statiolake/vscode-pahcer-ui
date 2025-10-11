import * as vscode from 'vscode';
import { type Execution, getShortTitle } from '../domain/models/execution';
import { calculateSeedStats } from '../domain/services/aggregationService';
import { groupBySeed } from '../domain/services/groupingService';
import type {
	ExecutionSortOrder,
	GroupingMode,
	SeedSortOrder,
} from '../domain/services/sortingService';
import { sortExecutionsForSeed, sortTestCases } from '../domain/services/sortingService';
import { ConfigAdapter } from '../infrastructure/configAdapter';
import { ExecutionRepository } from '../infrastructure/executionRepository';
import { PahcerAdapter, PahcerStatus } from '../infrastructure/pahcerAdapter';
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
	execution?: Execution;
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
	private configAdapter: ConfigAdapter;
	private treeItemBuilder: TreeItemBuilder;

	constructor(workspaceRoot: string) {
		this.pahcerAdapter = new PahcerAdapter(workspaceRoot);
		this.executionRepository = new ExecutionRepository(workspaceRoot);
		this.configAdapter = new ConfigAdapter();
		this.treeItemBuilder = new TreeItemBuilder();
	}

	/**
	 * TreeViewをリフレッシュ
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * グルーピングモードを設定
	 */
	async setGroupingMode(mode: GroupingMode): Promise<void> {
		await this.configAdapter.setGroupingMode(mode);
		this.refresh();
	}

	/**
	 * グルーピングモードを取得
	 */
	getGroupingMode(): GroupingMode {
		return this.configAdapter.getGroupingMode();
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
		this.refresh();
	}

	/**
	 * 実行ごとのソート順を設定
	 */
	async setExecutionSortOrder(order: ExecutionSortOrder): Promise<void> {
		await this.configAdapter.setExecutionSortOrder(order);
		this.refresh();
	}

	/**
	 * 実行ごとのソート順を取得
	 */
	getExecutionSortOrder(): ExecutionSortOrder {
		return this.configAdapter.getExecutionSortOrder();
	}

	/**
	 * Seedごとのソート順を設定
	 */
	async setSeedSortOrder(order: SeedSortOrder): Promise<void> {
		await this.configAdapter.setSeedSortOrder(order);
		this.refresh();
	}

	/**
	 * Seedごとのソート順を取得
	 */
	getSeedSortOrder(): SeedSortOrder {
		return this.configAdapter.getSeedSortOrder();
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
		const status = this.pahcerAdapter.checkStatus();

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
		} else if (element.itemType === 'execution' && element.execution) {
			// Show cases for a result
			return this.getCasesForExecution(element.execution);
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
		const executions = await this.executionRepository.loadLatestExecutions();

		if (executions.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		const items: PahcerTreeItem[] = [];

		for (const execution of executions) {
			// Build tree item
			const builtItem = this.treeItemBuilder.buildExecutionItem(
				execution,
				true, // Always show checkbox
				this.checkedResults.has(execution.id),
			);

			const item = new PahcerTreeItem(
				builtItem.label as string,
				builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
				'execution',
				builtItem.description as string,
			);
			item.executionId = execution.id;
			item.execution = execution;
			item.checkboxState = builtItem.checkboxState;
			item.iconPath = builtItem.iconPath;

			items.push(item);
		}

		return items;
	}

	/**
	 * 実行結果のテストケース一覧を取得
	 */
	private async getCasesForExecution(execution: Execution): Promise<PahcerTreeItem[]> {
		const items: PahcerTreeItem[] = [];

		// Summary
		const summaryBuilt = this.treeItemBuilder.buildSummaryItem(execution);
		const summaryItem = new PahcerTreeItem(
			summaryBuilt.label as string,
			summaryBuilt.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
			'summary',
		);
		summaryItem.iconPath = summaryBuilt.iconPath;
		items.push(summaryItem);

		// Sort cases
		const sortOrder = this.getExecutionSortOrder();
		const sortedCases = sortTestCases(execution.cases, sortOrder);

		// Cases
		for (const testCase of sortedCases) {
			const builtItem = this.treeItemBuilder.buildTestCaseItem(testCase, execution.id);
			const item = new PahcerTreeItem(
				builtItem.label as string,
				builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
				'case',
				builtItem.description as string,
			);
			item.seed = testCase.seed;
			item.executionId = execution.id;
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
		const executions = await this.executionRepository.loadLatestExecutions();

		if (executions.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		// Calculate seed stats
		const statsMap = calculateSeedStats(executions);
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
		const executions = await this.executionRepository.loadLatestExecutions();

		// Group by seed
		const grouped = groupBySeed(executions);
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

			const builtItem = this.treeItemBuilder.buildSeedExecutionItem(
				time,
				executionData.testCase,
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
			const execution = await this.executionRepository.loadExecution(executionId);
			if (execution?.commitHash) {
				results.push(execution);
			}
		}
		return results;
	}
}
