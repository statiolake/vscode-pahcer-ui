import * as vscode from 'vscode';
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
		// Format timestamps as MM/DD HH:mm@hash
		const formatTitle = (result: typeof older) => {
			const date = new Date(result.result.startTime);
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			const shortHash = result.result.commitHash?.slice(0, 7) || '';
			return `${month}/${day} ${hours}:${minutes}@${shortHash}`;
		};

		const gitAdapter = new GitAdapter(workspaceRoot);
		await gitAdapter.showDiff(
			older.result.commitHash,
			newer.result.commitHash,
			formatTitle(older),
			formatTitle(newer),
		);
	} catch (error) {
		vscode.window.showErrorMessage(`差分表示に失敗しました: ${error}`);
	}
}
