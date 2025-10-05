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

export class PahcerResultsProvider implements vscode.TreeDataProvider<ResultItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ResultItem | undefined | null> =
		new vscode.EventEmitter<ResultItem | undefined | null>();
	readonly onDidChangeTreeData: vscode.Event<ResultItem | undefined | null> =
		this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: ResultItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: ResultItem): Promise<ResultItem[]> {
		if (!this.workspaceRoot) {
			return [];
		}

		if (!element) {
			// Root level: show all results
			return this.getResults();
		} else if (element.contextValue === 'result' && element.result) {
			// Show cases for a result
			return this.getCases(element.result, element.resultId);
		} else {
			return [];
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

				const time = new Date(result.start_time).toLocaleString();
				const acCount = result.case_count - result.wa_seeds.length;
				const avgScore =
					result.case_count > 0 ? (result.total_score / result.case_count).toFixed(2) : '0.00';
				const avgRel =
					result.case_count > 0
						? (result.total_relative_score / result.case_count).toFixed(3)
						: '0.000';

				const label = `${time} - AC:${acCount}/${result.case_count} Score:${avgScore} Rel:${avgRel}`;
				const description = result.comment || (result.tag_name || '').replace('pahcer/', '');

				// Extract result ID from filename
				const resultId = file.replace(/^result_(.+)\.json$/, '$1');

				const item = new ResultItem(
					label,
					vscode.TreeItemCollapsibleState.Collapsed,
					'result',
					description,
				);
				item.result = result;
				item.resultId = resultId;

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

		// Cases
		for (const testCase of result.cases) {
			const label = `Seed ${testCase.seed}: ${testCase.score.toLocaleString()} (${testCase.relative_score.toFixed(3)}%)`;
			const description = `${(testCase.execution_time * 1000).toFixed(2)}ms`;

			const item = new ResultItem(label, vscode.TreeItemCollapsibleState.None, 'case', description);
			item.seed = testCase.seed;

			// Make clickable
			item.command = {
				command: 'vscode-pahcer-ui.showVisualizer',
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
}
