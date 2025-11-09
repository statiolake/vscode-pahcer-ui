import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import type { PahcerAdapter } from '../../infrastructure/pahcerAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	pahcerAdapter: PahcerAdapter,
	treeViewController: PahcerTreeViewController,
): () => Promise<void> {
	return async () => {
		try {
			await pahcerAdapter.run();
			treeViewController.refresh();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
		}
	};
}
