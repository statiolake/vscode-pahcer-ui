import * as vscode from 'vscode';
import { getTitleWithHash } from '../../../domain/models/execution';
import { GitAdapter } from '../../../infrastructure/gitAdapter';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * チェックされた2つの結果の差分を表示
 */
export function showDiffCommand(
	treeViewController: PahcerTreeViewController,
	workspaceRoot: string,
): () => Promise<void> {
	return async () => {
		const checkedExecutions = await treeViewController.getCheckedResultsWithCommitHash();

		if (checkedExecutions.length !== 2) {
			vscode.window.showErrorMessage('コミットハッシュを持つ実行結果を2つ選択してください');
			return;
		}

		// Sort by startTime to ensure older is left, newer is right
		const sorted = checkedExecutions.sort((a, b) => a.startTime.valueOf() - b.startTime.valueOf());

		const [older, newer] = sorted;

		if (!older.commitHash || !newer.commitHash) {
			vscode.window.showErrorMessage('選択された結果にコミットハッシュがありません');
			return;
		}

		try {
			const gitAdapter = new GitAdapter(workspaceRoot);
			await gitAdapter.showDiff(
				older.commitHash,
				newer.commitHash,
				getTitleWithHash(older),
				getTitleWithHash(newer),
			);
		} catch (error) {
			vscode.window.showErrorMessage(`差分表示に失敗しました: ${error}`);
		}
	};
}
