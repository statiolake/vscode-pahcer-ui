import * as vscode from 'vscode';
import type { ShowExecutionDiffUseCase } from '../../../application/showExecutionDiffUseCase';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * チェックされた2つの結果の差分を表示
 */
export function showDiffCommand(
  treeViewController: PahcerTreeViewController,
  showExecutionDiffUseCase: ShowExecutionDiffUseCase,
): () => Promise<void> {
  return async () => {
    try {
      const result = await showExecutionDiffUseCase.showDiff(
        treeViewController.getCheckedResults(),
      );
      if (result.status === 'invalidSelection') {
        vscode.window.showErrorMessage('コミットハッシュを持つ実行結果を2つ選択してください');
      } else if (result.status === 'missingCommitHash') {
        vscode.window.showErrorMessage('選択された結果にコミットハッシュがありません');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`差分表示に失敗しました: ${error}`);
    }
  };
}
