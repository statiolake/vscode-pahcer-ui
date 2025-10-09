import * as vscode from 'vscode';
import { getTitleWithHash } from '../../domain/models/pahcerResult';
import { GitAdapter } from '../../infrastructure/gitAdapter';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * チェックされた2つの結果の差分を表示
 */
export async function showDiffCommand(
	treeViewController: PahcerTreeViewController,
	workspaceRoot: string,
): Promise<void> {
	const checkedResults = await treeViewController.getCheckedResultsWithCommitHash();

	if (checkedResults.length !== 2) {
		vscode.window.showErrorMessage('コミットハッシュを持つ実行結果を2つ選択してください');
		return;
	}

	// Sort by startTime to ensure older is left, newer is right
	const sorted = checkedResults.sort(
		(a, b) => new Date(a.result.startTime).getTime() - new Date(b.result.startTime).getTime(),
	);

	const [older, newer] = sorted;

	if (!older.result.commitHash || !newer.result.commitHash) {
		vscode.window.showErrorMessage('選択された結果にコミットハッシュがありません');
		return;
	}

	try {
		const gitAdapter = new GitAdapter(workspaceRoot);
		await gitAdapter.showDiff(
			older.result.commitHash,
			newer.result.commitHash,
			getTitleWithHash(older.result),
			getTitleWithHash(newer.result),
		);
	} catch (error) {
		vscode.window.showErrorMessage(`差分表示に失敗しました: ${error}`);
	}
}
