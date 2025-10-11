import * as vscode from 'vscode';
import {
	type Execution,
	getAcCount,
	getAverageRelativeScore,
	getAverageScore,
	getShortTitle,
} from '../../domain/models/execution';
import type { TestCase } from '../../domain/models/testCase';
import type { SeedStats } from '../../domain/services/aggregationService';

/**
 * TreeItem を生成するビルダー
 */
export class TreeItemBuilder {
	/**
	 * 実行結果のTreeItemを生成
	 */
	buildExecutionItem(
		execution: Execution,
		comparisonMode: boolean,
		isChecked: boolean,
	): vscode.TreeItem {
		const time = getShortTitle(execution);
		const acCount = getAcCount(execution);
		const avgScore = getAverageScore(execution).toFixed(1);
		const avgRel = getAverageRelativeScore(execution).toFixed(2);

		const label = `${time} - Avg: ${avgScore} (${avgRel}%)`;
		const description = execution.comment || (execution.tagName || '').replace('pahcer/', '');

		const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
		treeItem.contextValue = 'execution';
		treeItem.description = description;

		// Add checkbox only in comparison mode
		if (comparisonMode) {
			treeItem.checkboxState = isChecked
				? vscode.TreeItemCheckboxState.Checked
				: vscode.TreeItemCheckboxState.Unchecked;
		}

		// Icon based on commit hash and AC status
		if (execution.commitHash) {
			// Has commit hash - use git icon with appropriate color
			if (execution.waSeeds.length === 0) {
				treeItem.iconPath = new vscode.ThemeIcon(
					'git-commit',
					new vscode.ThemeColor('testing.iconPassed'),
				);
			} else if (acCount > 0) {
				treeItem.iconPath = new vscode.ThemeIcon(
					'git-commit',
					new vscode.ThemeColor('testing.iconQueued'),
				);
			} else {
				treeItem.iconPath = new vscode.ThemeIcon(
					'git-commit',
					new vscode.ThemeColor('testing.iconFailed'),
				);
			}
		} else {
			// No commit hash - use regular icons
			if (execution.waSeeds.length === 0) {
				treeItem.iconPath = new vscode.ThemeIcon(
					'pass',
					new vscode.ThemeColor('testing.iconPassed'),
				);
			} else if (acCount > 0) {
				treeItem.iconPath = new vscode.ThemeIcon(
					'warning',
					new vscode.ThemeColor('testing.iconQueued'),
				);
			} else {
				treeItem.iconPath = new vscode.ThemeIcon(
					'error',
					new vscode.ThemeColor('testing.iconFailed'),
				);
			}
		}

		return treeItem;
	}

	/**
	 * サマリーのTreeItemを生成
	 */
	buildSummaryItem(execution: Execution): vscode.TreeItem {
		const acCount = getAcCount(execution);
		const summaryLabel = `AC: ${acCount}/${execution.caseCount}, Total Score: ${execution.totalScore.toLocaleString()}, Max Time: ${(execution.maxExecutionTime * 1000).toFixed(0)}ms`;
		const summaryItem = new vscode.TreeItem(summaryLabel, vscode.TreeItemCollapsibleState.None);
		summaryItem.contextValue = 'summary';
		summaryItem.iconPath = new vscode.ThemeIcon('info');
		return summaryItem;
	}

	/**
	 * テストケースのTreeItemを生成
	 */
	buildTestCaseItem(testCase: TestCase, resultId?: string): vscode.TreeItem {
		const seedStr = String(testCase.seed).padStart(4, '0');
		const label = `${seedStr}: ${testCase.score} (${testCase.relativeScore.toFixed(3)}%)`;
		const description = `${(testCase.executionTime * 1000).toFixed(2)}ms`;

		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'case';
		item.description = description;

		// Make clickable only if output file is found
		if (testCase.foundOutput) {
			item.command = {
				command: 'pahcer-ui.showVisualizer',
				title: 'Show Visualizer',
				arguments: [testCase.seed, resultId],
			};
		} else {
			// For cases without output file, show error notification
			item.command = {
				command: 'pahcer-ui.showResultsNotFoundError',
				title: 'Show Results Not Found Error',
				arguments: [testCase.seed],
			};
		}

		if (!testCase.foundOutput) {
			item.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconQueued'));
			item.tooltip = '出力ファイルが保存されていません';
		} else if (testCase.score === 0 || testCase.errorMessage) {
			item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
			item.tooltip = testCase.errorMessage || 'WA';
		} else {
			item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
		}

		return item;
	}

	/**
	 * SeedのTreeItemを生成
	 */
	buildSeedItem(stats: SeedStats): vscode.TreeItem {
		const seedStr = String(stats.seed).padStart(4, '0');
		const label = seedStr;
		const description = `${stats.count} runs - Avg: ${stats.averageScore.toFixed(2)} (${stats.averageRelativeScore.toFixed(3)}%)`;

		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
		item.contextValue = 'seed';
		item.description = description;
		item.iconPath = new vscode.ThemeIcon('symbol-number');

		return item;
	}

	/**
	 * Seed別の実行結果のTreeItemを生成
	 */
	buildSeedExecutionItem(
		time: string,
		testCase: TestCase,
		seed: number,
		resultId: string,
		isLatest: boolean,
		comparisonMode: boolean,
		isChecked: boolean,
	): vscode.TreeItem {
		const label = `${time}: ${testCase.score.toLocaleString()} (${testCase.relativeScore.toFixed(3)}%)`;
		const description = `${(testCase.executionTime * 1000).toFixed(2)}ms`;

		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'execution';
		item.description = description;

		// Add checkbox for comparison mode
		if (comparisonMode) {
			item.checkboxState = isChecked
				? vscode.TreeItemCheckboxState.Checked
				: vscode.TreeItemCheckboxState.Unchecked;
		}

		// Make clickable only if output file is found
		if (testCase.foundOutput) {
			item.command = {
				command: 'pahcer-ui.showVisualizer',
				title: 'Show Visualizer',
				arguments: [seed, resultId],
			};
		} else {
			item.command = {
				command: 'pahcer-ui.showResultsNotFoundError',
				title: 'Show Results Not Found Error',
				arguments: [seed],
			};
		}

		// Highlight latest execution
		if (!testCase.foundOutput) {
			item.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconQueued'));
			item.tooltip = '出力ファイルが保存されていません';
		} else if (isLatest) {
			item.iconPath = new vscode.ThemeIcon(
				'debug-stackframe-focused',
				new vscode.ThemeColor('charts.blue'),
			);
		} else if (testCase.score === 0 || testCase.errorMessage) {
			item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
			item.tooltip = testCase.errorMessage || 'WA';
		} else {
			item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
		}

		return item;
	}

	/**
	 * 情報メッセージのTreeItemを生成
	 */
	buildInfoItem(message: string): vscode.TreeItem {
		return new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
	}
}
