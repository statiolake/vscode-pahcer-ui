import * as vscode from 'vscode';
import type { MetadataRepository } from '../../infrastructure/metadataRepository';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * コメント追加コマンドハンドラ
 */
export async function addCommentCommand(
	item: any,
	metadataRepository: MetadataRepository,
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

	// Save comment
	await metadataRepository.save(item.resultId, { comment });

	// Refresh tree view
	treeViewController.refresh();
	vscode.window.showInformationMessage('コメントを保存しました');
}
