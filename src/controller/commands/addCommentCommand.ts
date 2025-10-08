import * as vscode from 'vscode';
import type { PahcerResultRepository } from '../../infrastructure/pahcerResultRepository';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * コメント追加コマンドハンドラ
 */
export async function addCommentCommand(
	item: any,
	resultRepository: PahcerResultRepository,
	treeViewController: PahcerTreeViewController,
): Promise<void> {
	if (!item?.resultId) {
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
		await resultRepository.updateComment(item.resultId, comment);

		// Refresh tree view
		treeViewController.refresh();
		vscode.window.showInformationMessage('コメントを保存しました');
	} catch (error) {
		vscode.window.showErrorMessage(`コメントの保存に失敗しました: ${error}`);
	}
}
