import * as vscode from 'vscode';
import { getShortTitle } from '../../../domain/models/execution';
import type { TestCase } from '../../../domain/models/testCase';
import type { ExecutionStatsCalculator } from '../../../domain/services/executionStatsAggregator';
import type { SeedStatsCalculator } from '../../../domain/services/seedStatsCalculator';

/**
 * TreeItem を生成するビルダー
 */
export class TreeItemBuilder {
  /**
   * 実行結果のTreeItemを生成
   */
  buildExecutionItem(
    executionStats: ExecutionStatsCalculator.ExecutionStats,
    comparisonMode: boolean,
    isChecked: boolean,
  ): vscode.TreeItem {
    const time = getShortTitle(executionStats.execution);
    const avgScore = executionStats.averageScore.toFixed(1);
    const avgRel = executionStats.averageRelativeScore.toFixed(2);

    const label = `${time} - Avg: ${avgScore} (${avgRel}%)`;
    const description =
      executionStats.execution.comment ||
      (executionStats.execution.tagName || '').replace('pahcer/', '');

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
    if (executionStats.execution.commitHash) {
      // Has commit hash - use git icon with appropriate color
      if (executionStats.waSeeds.length === 0) {
        treeItem.iconPath = new vscode.ThemeIcon(
          'git-commit',
          new vscode.ThemeColor('testing.iconPassed'),
        );
      } else if (executionStats.acCount > 0) {
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
      if (executionStats.waSeeds.length === 0) {
        treeItem.iconPath = new vscode.ThemeIcon(
          'pass',
          new vscode.ThemeColor('testing.iconPassed'),
        );
      } else if (executionStats.acCount > 0) {
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
  buildSummaryItem(executionStats: ExecutionStatsCalculator.ExecutionStats): vscode.TreeItem {
    const summaryLabel = `AC: ${executionStats.acCount}/${executionStats.caseCount}, Total Score: ${executionStats.totalScore.toLocaleString()}, Max Time: ${(executionStats.maxExecutionTime * 1000).toFixed(0)}ms`;
    const summaryItem = new vscode.TreeItem(summaryLabel, vscode.TreeItemCollapsibleState.None);
    summaryItem.contextValue = 'summary';
    summaryItem.iconPath = new vscode.ThemeIcon('info');
    return summaryItem;
  }

  /**
   * テストケースのTreeItemを生成
   * @param testCase テストケース
   * @param relativeScore 相対スコア（%）
   * @param resultId 実行結果ID
   */
  buildTestCaseItem(testCase: TestCase, relativeScore: number, resultId?: string): vscode.TreeItem {
    const seedStr = String(testCase.id.seed).padStart(4, '0');
    const label = `${seedStr}: ${testCase.score} (${relativeScore.toFixed(3)}%)`;
    const description = `${(testCase.executionTime * 1000).toFixed(2)}ms`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'case';
    item.description = description;

    // Make clickable only if output file is found
    if (testCase.foundOutput) {
      item.command = {
        command: 'pahcer-ui.showVisualizer',
        title: 'Show Visualizer',
        arguments: [testCase.id.seed, resultId],
      };
    } else {
      // For cases without output file, show error notification
      item.command = {
        command: 'pahcer-ui.showResultsNotFoundError',
        title: 'Show Results Not Found Error',
        arguments: [testCase.id.seed],
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
  buildSeedItem(stats: SeedStatsCalculator.SeedStats): vscode.TreeItem {
    const seedStr = String(stats.seed).padStart(4, '0');
    const label = seedStr;
    const description = `${stats.count} runs - Avg: ${stats.averageScore.toFixed(2)}`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = 'seed';
    item.description = description;
    item.iconPath = new vscode.ThemeIcon('symbol-number');

    return item;
  }

  /**
   * Seed別の実行結果のTreeItemを生成
   * @param time 実行時刻（短形式）
   * @param testCase テストケース
   * @param relativeScore 相対スコア（%）
   * @param seed Seed番号
   * @param resultId 実行結果ID
   * @param isLatest 最新実行かどうか
   * @param comparisonMode 比較モードかどうか
   * @param isChecked チェック済みかどうか
   */
  buildSeedExecutionItem(
    time: string,
    testCase: TestCase,
    relativeScore: number,
    seed: number,
    resultId: string,
    isLatest: boolean,
    comparisonMode: boolean,
    isChecked: boolean,
  ): vscode.TreeItem {
    const label = `${time}: ${testCase.score.toLocaleString()} (${relativeScore.toFixed(3)}%)`;
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
