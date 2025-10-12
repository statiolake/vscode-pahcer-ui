import type { DialogAdapter } from '../../infrastructure/dialogAdapter';
import type { ExecutionRepository } from '../../infrastructure/executionRepository';
import type { PahcerTreeItem, PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * コメント追加コマンドハンドラ
 */
export function addCommentCommand(
	executionRepository: ExecutionRepository,
	treeViewController: PahcerTreeViewController,
	dialogAdapter: DialogAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.executionId) {
			return;
		}

		const comment = await dialogAdapter.showInputBox({
			prompt: 'コメントを入力してください',
			placeHolder: 'この実行についてのメモ...',
			value: item.comment || '',
		});

		if (comment === undefined) {
			return;
		}

		// Update comment in pahcer's JSON file
		try {
			await executionRepository.updateExecutionComment(item.executionId, comment);

			// Refresh tree view
			treeViewController.refresh();
			dialogAdapter.showInformationMessage('コメントを保存しました');
		} catch (error) {
			dialogAdapter.showErrorMessage(`コメントの保存に失敗しました: ${error}`);
		}
	};
}
