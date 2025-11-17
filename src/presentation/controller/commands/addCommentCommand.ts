import * as vscode from 'vscode';
import type { IExecutionRepository } from '../../../domain/interfaces/IExecutionRepository';
import type { PahcerTreeItem, PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * コメント追加コマンドハンドラ
 */
export function addCommentCommand(
  executionRepository: IExecutionRepository,
  treeViewController: PahcerTreeViewController,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    if (!item.executionId) {
      return;
    }

    const comment = await vscode.window.showInputBox({
      prompt: 'コメントを入力してください',
      placeHolder: 'この実行についてのメモ...',
      value: item.comment || '',
    });

    if (comment === undefined) {
      return;
    }

    // Update comment in pahcer's JSON file
    try {
      const execution = await executionRepository.findById(item.executionId);
      if (!execution) {
        vscode.window.showErrorMessage('実行結果が見つかりませんでした');
        return;
      }
      execution.comment = comment;
      await executionRepository.upsert(execution);

      // Refresh tree view
      treeViewController.refresh();
      vscode.window.showInformationMessage('コメントを保存しました');
    } catch (error) {
      vscode.window.showErrorMessage(`コメントの保存に失敗しました: ${error}`);
    }
  };
}
