import * as vscode from 'vscode';
import type { AppUIConfig } from '../../appUIConfig';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * ソート順変更コマンドハンドラ
 */
export function changeSortOrderCommand(
  appUIConfig: AppUIConfig,
  treeViewController: PahcerTreeViewController,
): () => Promise<void> {
  return async () => {
    const mode = await appUIConfig.groupingMode();

    if (mode === 'byExecution') {
      const currentOrder = await appUIConfig.executionSortOrder();
      const options = [
        { label: 'シードの昇順', value: 'seedAsc' as const },
        { label: 'シードの降順', value: 'seedDesc' as const },
        { label: '相対スコアの昇順', value: 'relativeScoreAsc' as const },
        { label: '相対スコアの降順', value: 'relativeScoreDesc' as const },
        { label: '絶対スコアの昇順', value: 'absoluteScoreAsc' as const },
        { label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
      });

      if (selected) {
        await appUIConfig.setExecutionSortOrder(selected.value);
        treeViewController.refresh();
      }
    } else {
      const currentOrder = await appUIConfig.seedSortOrder();
      const options = [
        { label: '実行の昇順', value: 'executionAsc' as const },
        { label: '実行の降順', value: 'executionDesc' as const },
        { label: '絶対スコアの昇順', value: 'absoluteScoreAsc' as const },
        { label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
      });

      if (selected) {
        await appUIConfig.setSeedSortOrder(selected.value);
        treeViewController.refresh();
      }
    }
  };
}
