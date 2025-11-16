import * as vscode from 'vscode';
import type { RunPahcerUseCase } from '../../../application/runPahcerUseCase';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	runPahcerUseCase: RunPahcerUseCase,
	treeViewController: PahcerTreeViewController,
): () => Promise<void> {
	return async () => {
		try {
			await runPahcerUseCase.run();
			treeViewController.refresh();
		} catch (error) {
			console.error(error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
		}
	};
}
