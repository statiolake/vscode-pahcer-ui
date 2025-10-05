import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

interface PahcerResult {
	start_time: string;
	case_count: number;
	total_score: number;
	total_score_log10: number;
	total_relative_score: number;
	max_execution_time: number;
	comment: string;
	tag_name: string | null;
	wa_seeds: number[];
	cases: Array<{
		seed: number;
		score: number;
		relative_score: number;
		execution_time: number;
		error_message: string;
	}>;
}

export type GroupingMode = 'byExecution' | 'bySeed';
export type ExecutionSortOrder =
	| 'seedAsc'
	| 'seedDesc'
	| 'relativeScoreAsc'
	| 'relativeScoreDesc'
	| 'absoluteScoreAsc'
	| 'absoluteScoreDesc';
export type SeedSortOrder =
	| 'executionAsc'
	| 'executionDesc'
	| 'absoluteScoreAsc'
	| 'absoluteScoreDesc';

export class PahcerResultsProvider implements vscode.TreeDataProvider<ResultItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ResultItem | undefined | null> =
		new vscode.EventEmitter<ResultItem | undefined | null>();
	readonly onDidChangeTreeData: vscode.Event<ResultItem | undefined | null> =
		this._onDidChangeTreeData.event;

	private checkedResults = new Set<string>();
	private comparisonMode = false;

	constructor(private workspaceRoot: string | undefined) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	async setGroupingMode(mode: GroupingMode): Promise<void> {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		await config.update('groupingMode', mode, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	getGroupingMode(): GroupingMode {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		return config.get<GroupingMode>('groupingMode') || 'byExecution';
	}

	getCheckedResults(): string[] {
		return Array.from(this.checkedResults);
	}

	toggleCheckbox(resultId: string): void {
		if (this.checkedResults.has(resultId)) {
			this.checkedResults.delete(resultId);
		} else {
			this.checkedResults.add(resultId);
		}
		this.refresh();
	}

	setComparisonMode(enabled: boolean): void {
		this.comparisonMode = enabled;
		if (!enabled) {
			this.checkedResults.clear();
		}
		this.refresh();
	}

	getComparisonMode(): boolean {
		return this.comparisonMode;
	}

	async setExecutionSortOrder(order: ExecutionSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		await config.update('executionSortOrder', order, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	async setSeedSortOrder(order: SeedSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		await config.update('seedSortOrder', order, vscode.ConfigurationTarget.Global);
		this.refresh();
	}

	getExecutionSortOrder(): ExecutionSortOrder {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		return config.get<ExecutionSortOrder>('executionSortOrder') || 'seedAsc';
	}

	getSeedSortOrder(): SeedSortOrder {
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		return config.get<SeedSortOrder>('seedSortOrder') || 'executionDesc';
	}

	getTreeItem(element: ResultItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: ResultItem): Promise<ResultItem[]> {
		if (!this.workspaceRoot) {
			return [];
		}

		const groupingMode = this.getGroupingMode();
		if (groupingMode === 'byExecution') {
			if (!element) {
				// Root level: show all results
				return this.getResults();
			} else if (element.contextValue === 'execution' && element.result) {
				// Show cases for a result
				return this.getCases(element.result, element.resultId);
			} else {
				return [];
			}
		} else {
			// bySeed mode
			if (!element) {
				// Root level: show all seeds
				return this.getSeeds();
			} else if (element.contextValue === 'seed') {
				// Show executions for a seed
				return this.getExecutionsForSeed(element.seed!);
			} else {
				return [];
			}
		}
	}

	private async getResults(): Promise<ResultItem[]> {
		if (!this.workspaceRoot) {
			return [new ResultItem('No workspace found', vscode.TreeItemCollapsibleState.None, 'info')];
		}

		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [new ResultItem('No results found', vscode.TreeItemCollapsibleState.None, 'info')];
		}

		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse()
			.slice(0, 10);

		const results: ResultItem[] = [];
		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const result: PahcerResult = JSON.parse(content);

				// Extract result ID from filename
				const resultId = file.replace(/^result_(.+)\.json$/, '$1');

				// Load comment from meta.json
				let comment = '';
				const metaPath = path.join(
					this.workspaceRoot!,
					'.pahcer-ui',
					'results',
					`result_${resultId}`,
					'meta.json',
				);
				if (fs.existsSync(metaPath)) {
					try {
						const metaContent = fs.readFileSync(metaPath, 'utf-8');
						const meta = JSON.parse(metaContent);
						comment = meta.comment || '';
					} catch (e) {
						// Ignore meta.json read errors
					}
				}

				const time = new Date(result.start_time).toLocaleString();
				const acCount = result.case_count - result.wa_seeds.length;
				const avgScore =
					result.case_count > 0 ? (result.total_score / result.case_count).toFixed(2) : '0.00';
				const avgRel =
					result.case_count > 0
						? (result.total_relative_score / result.case_count).toFixed(3)
						: '0.000';

				const label = comment
					? `[${comment}] ${time} - AC:${acCount}/${result.case_count} Score:${avgScore} Rel:${avgRel}`
					: `${time} - AC:${acCount}/${result.case_count} Score:${avgScore} Rel:${avgRel}`;
				const description = result.comment || (result.tag_name || '').replace('pahcer/', '');

				const item = new ResultItem(
					label,
					vscode.TreeItemCollapsibleState.Collapsed,
					'execution',
					description,
				);
				item.result = result;
				item.resultId = resultId;
				item.comment = comment;

				// Add checkbox only in comparison mode
				if (this.comparisonMode) {
					item.checkboxState = this.checkedResults.has(resultId)
						? vscode.TreeItemCheckboxState.Checked
						: vscode.TreeItemCheckboxState.Unchecked;
				}

				// Icon based on AC status
				if (result.wa_seeds.length === 0) {
					item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
				} else if (acCount > 0) {
					item.iconPath = new vscode.ThemeIcon(
						'warning',
						new vscode.ThemeColor('testing.iconQueued'),
					);
				} else {
					item.iconPath = new vscode.ThemeIcon(
						'error',
						new vscode.ThemeColor('testing.iconFailed'),
					);
				}

				results.push(item);
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		return results;
	}

	private getCases(result: PahcerResult, resultId?: string): ResultItem[] {
		const items: ResultItem[] = [];

		// Summary
		const summaryLabel = `Total Score: ${result.total_score.toLocaleString()}, Max Time: ${(result.max_execution_time * 1000).toFixed(0)}ms`;
		const summaryItem = new ResultItem(
			summaryLabel,
			vscode.TreeItemCollapsibleState.None,
			'summary',
		);
		summaryItem.iconPath = new vscode.ThemeIcon('info');
		items.push(summaryItem);

		// Sort cases based on execution sort order
		const sortedCases = [...result.cases];
		const executionSortOrder = this.getExecutionSortOrder();
		switch (executionSortOrder) {
			case 'seedAsc':
				sortedCases.sort((a, b) => a.seed - b.seed);
				break;
			case 'seedDesc':
				sortedCases.sort((a, b) => b.seed - a.seed);
				break;
			case 'relativeScoreAsc':
				sortedCases.sort((a, b) => a.relative_score - b.relative_score);
				break;
			case 'relativeScoreDesc':
				sortedCases.sort((a, b) => b.relative_score - a.relative_score);
				break;
			case 'absoluteScoreAsc':
				sortedCases.sort((a, b) => a.score - b.score);
				break;
			case 'absoluteScoreDesc':
				sortedCases.sort((a, b) => b.score - a.score);
				break;
		}

		// Cases
		for (const testCase of sortedCases) {
			const label = `Seed ${testCase.seed}: ${testCase.score.toLocaleString()} (${testCase.relative_score.toFixed(3)}%)`;
			const description = `${(testCase.execution_time * 1000).toFixed(2)}ms`;

			const item = new ResultItem(label, vscode.TreeItemCollapsibleState.None, 'case', description);
			item.seed = testCase.seed;

			// Make clickable
			item.command = {
				command: 'pahcer-ui.showVisualizer',
				title: 'Show Visualizer',
				arguments: [testCase.seed, resultId],
			};

			if (testCase.score === 0 || testCase.error_message) {
				item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
				item.tooltip = testCase.error_message || 'WA';
			} else {
				item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
			}

			items.push(item);
		}

		return items;
	}

	private async getSeeds(): Promise<ResultItem[]> {
		if (!this.workspaceRoot) {
			return [new ResultItem('No workspace found', vscode.TreeItemCollapsibleState.None, 'info')];
		}

		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [new ResultItem('No results found', vscode.TreeItemCollapsibleState.None, 'info')];
		}

		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse()
			.slice(0, 10);

		// Collect all seeds from all results
		const seedMap = new Map<number, { count: number; totalScore: number; totalRel: number }>();

		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const result: PahcerResult = JSON.parse(content);

				for (const testCase of result.cases) {
					const existing = seedMap.get(testCase.seed) || { count: 0, totalScore: 0, totalRel: 0 };
					seedMap.set(testCase.seed, {
						count: existing.count + 1,
						totalScore: existing.totalScore + testCase.score,
						totalRel: existing.totalRel + testCase.relative_score,
					});
				}
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		// Create items for each seed
		const items: ResultItem[] = [];
		const sortedSeeds = Array.from(seedMap.entries()).sort((a, b) => a[0] - b[0]);

		for (const [seed, stats] of sortedSeeds) {
			const avgScore = (stats.totalScore / stats.count).toFixed(2);
			const avgRel = (stats.totalRel / stats.count).toFixed(3);
			const label = `Seed ${seed}`;
			const description = `${stats.count} runs - Avg: ${avgScore} (${avgRel}%)`;

			const item = new ResultItem(
				label,
				vscode.TreeItemCollapsibleState.Collapsed,
				'seed',
				description,
			);
			item.seed = seed;
			item.iconPath = new vscode.ThemeIcon('symbol-number');

			items.push(item);
		}

		return items;
	}

	private async getExecutionsForSeed(seed: number): Promise<ResultItem[]> {
		if (!this.workspaceRoot) {
			return [];
		}

		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [];
		}

		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse()
			.slice(0, 10);

		const executions: Array<{
			file: string;
			result: PahcerResult;
			testCase: PahcerResult['cases'][0];
			resultId: string;
		}> = [];

		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const result: PahcerResult = JSON.parse(content);

				// Find the test case for this seed
				const testCase = result.cases.find((c) => c.seed === seed);
				if (!testCase) {
					continue;
				}

				const resultId = file.replace(/^result_(.+)\.json$/, '$1');
				executions.push({ file, result, testCase, resultId });
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		// Sort executions based on seed sort order
		const seedSortOrder = this.getSeedSortOrder();
		switch (seedSortOrder) {
			case 'executionAsc':
				executions.sort((a, b) => a.file.localeCompare(b.file));
				break;
			case 'executionDesc':
				// Already sorted by file name (desc)
				break;
			case 'absoluteScoreAsc':
				executions.sort((a, b) => a.testCase.score - b.testCase.score);
				break;
			case 'absoluteScoreDesc':
				executions.sort((a, b) => b.testCase.score - a.testCase.score);
				break;
		}

		const items: ResultItem[] = [];
		const isLatestExecution = (index: number) => {
			// Find the latest by comparing file names (timestamps)
			const latestFile = [...executions].sort((a, b) => b.file.localeCompare(a.file))[0]?.file;
			return executions[index].file === latestFile;
		};

		for (let i = 0; i < executions.length; i++) {
			const { result, testCase, resultId } = executions[i];
			const time = new Date(result.start_time).toLocaleString();
			const label = `${time}: ${testCase.score.toLocaleString()} (${testCase.relative_score.toFixed(3)}%)`;
			const description = `${(testCase.execution_time * 1000).toFixed(2)}ms`;

			const item = new ResultItem(
				label,
				vscode.TreeItemCollapsibleState.None,
				'execution',
				description,
			);
			item.seed = seed;
			item.resultId = resultId;

			// Make clickable
			item.command = {
				command: 'pahcer-ui.showVisualizer',
				title: 'Show Visualizer',
				arguments: [seed, resultId],
			};

			// Highlight latest execution when sorted by absolute score
			if (
				(seedSortOrder === 'absoluteScoreAsc' || seedSortOrder === 'absoluteScoreDesc') &&
				isLatestExecution(i)
			) {
				item.iconPath = new vscode.ThemeIcon(
					'debug-stackframe-focused',
					new vscode.ThemeColor('charts.blue'),
				);
			} else if (testCase.score === 0 || testCase.error_message) {
				item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
				item.tooltip = testCase.error_message || 'WA';
			} else {
				item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
			}

			items.push(item);
		}

		return items;
	}
}

class ResultItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly description?: string,
	) {
		super(label, collapsibleState);
		this.description = description;
	}

	result?: PahcerResult;
	seed?: number;
	resultId?: string;
	comment?: string;
}
