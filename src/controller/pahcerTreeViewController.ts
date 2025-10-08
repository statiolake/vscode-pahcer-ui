import * as vscode from 'vscode';
import type { PahcerResultWithId } from '../domain/models/pahcerResult';
import { calculateSeedStats } from '../domain/services/aggregationService';
import { groupByExecution, groupBySeed } from '../domain/services/groupingService';
import type {
	ExecutionSortOrder,
	GroupingMode,
	SeedSortOrder,
} from '../domain/services/sortingService';
import { sortExecutionsForSeed, sortTestCases } from '../domain/services/sortingService';
import { ConfigAdapter } from '../infrastructure/configAdapter';
import { PahcerAdapter, PahcerStatus } from '../infrastructure/pahcerAdapter';
import { PahcerResultRepository } from '../infrastructure/pahcerResultRepository';
import { TreeItemBuilder } from '../view/treeView/treeItemBuilder';

/**
 * TreeItem with metadata
 */
class PahcerTreeItem extends vscode.TreeItem {
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

	resultId?: string;
	result?: PahcerResultWithId;
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
	private resultRepository: PahcerResultRepository;
	private configAdapter: ConfigAdapter;
	private treeItemBuilder: TreeItemBuilder;

	constructor(private workspaceRoot: string) {
		this.pahcerAdapter = new PahcerAdapter(workspaceRoot);
		this.resultRepository = new PahcerResultRepository(workspaceRoot);
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
		} else if (element.itemType === 'execution' && element.result) {
			// Show cases for a result
			return this.getCasesForExecution(element.result, element.resultId);
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
		const results = await this.resultRepository.loadLatestResults();

		if (results.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		const items: PahcerTreeItem[] = [];

		for (const resultWithId of results) {
			// Use comment from pahcer's JSON
			const comment = resultWithId.result.comment || '';

			// Build tree item
			const builtItem = this.treeItemBuilder.buildExecutionItem(
				resultWithId,
				comment,
				true, // Always show checkbox
				this.checkedResults.has(resultWithId.id),
			);

			const item = new PahcerTreeItem(
				builtItem.label as string,
				builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
				'execution',
				builtItem.description as string,
			);
			item.resultId = resultWithId.id;
			item.result = resultWithId;
			item.comment = comment;
			item.checkboxState = builtItem.checkboxState;
			item.iconPath = builtItem.iconPath;

			items.push(item);
		}

		return items;
	}

	/**
	 * 実行結果のテストケース一覧を取得
	 */
	private async getCasesForExecution(
		resultWithId: PahcerResultWithId,
		resultId?: string,
	): Promise<PahcerTreeItem[]> {
		const items: PahcerTreeItem[] = [];
		const result = resultWithId.result;

		// Summary
		const summaryBuilt = this.treeItemBuilder.buildSummaryItem(result);
		const summaryItem = new PahcerTreeItem(
			summaryBuilt.label as string,
			summaryBuilt.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
			'summary',
		);
		summaryItem.iconPath = summaryBuilt.iconPath;
		items.push(summaryItem);

		// Sort cases
		const sortOrder = this.getExecutionSortOrder();
		const sortedCases = sortTestCases(result.cases, sortOrder);

		// Cases
		for (const testCase of sortedCases) {
			const builtItem = this.treeItemBuilder.buildTestCaseItem(testCase, resultId);
			const item = new PahcerTreeItem(
				builtItem.label as string,
				builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
				'case',
				builtItem.description as string,
			);
			item.seed = testCase.seed;
			item.resultId = resultId;
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
		const results = await this.resultRepository.loadLatestResults();

		if (results.length === 0) {
			const item = new PahcerTreeItem(
				'No results found',
				vscode.TreeItemCollapsibleState.None,
				'info',
			);
			return [item];
		}

		// Calculate seed stats
		const statsMap = calculateSeedStats(results.map((r) => r.result));
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
		const results = await this.resultRepository.loadLatestResults();

		// Group by seed
		const grouped = groupBySeed(results);
		const seedGroup = grouped.find((g) => g.seed === seed);

		if (!seedGroup) {
			return [];
		}

		// Sort executions
		const sortOrder = this.getSeedSortOrder();
		const sortedExecutions = sortExecutionsForSeed(seedGroup.executions, sortOrder);

		// Find latest execution
		const latestFile = [...seedGroup.executions].sort((a, b) => b.file.localeCompare(a.file))[0]
			?.file;

		const items: PahcerTreeItem[] = [];

		for (const execution of sortedExecutions) {
			const time = this.formatDate(new Date(execution.result.startTime));
			const isLatest =
				execution.file === latestFile &&
				(sortOrder === 'absoluteScoreAsc' || sortOrder === 'absoluteScoreDesc');

			const builtItem = this.treeItemBuilder.buildSeedExecutionItem(
				time,
				execution.testCase,
				seed,
				execution.resultId,
				isLatest,
				true, // Show checkbox
				this.checkedResults.has(execution.resultId),
			);

			const item = new PahcerTreeItem(
				builtItem.label as string,
				builtItem.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
				'execution',
				builtItem.description as string,
			);
			item.seed = seed;
			item.resultId = execution.resultId;
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
	async getCheckedResultsWithCommitHash(): Promise<PahcerResultWithId[]> {
		const allResults = await this.resultRepository.loadLatestResults();
		return allResults.filter((r) => this.checkedResults.has(r.id) && r.result.commitHash);
	}

	/**
	 * 日付をフォーマット
	 */
	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hour = String(date.getHours()).padStart(2, '0');
		const minute = String(date.getMinutes()).padStart(2, '0');
		const second = String(date.getSeconds()).padStart(2, '0');
		return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
	}
}
