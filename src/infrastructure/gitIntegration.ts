import * as vscode from 'vscode';
import { GitAdapter } from './gitAdapter';

/**
 * Git統合の設定を確認し、必要なら初回ダイアログを表示
 */
export async function checkAndCommitIfEnabled(workspaceRoot: string): Promise<string | null> {
	const config = vscode.workspace.getConfiguration('pahcer-ui');
	let gitIntegration = config.get<boolean | null>('gitIntegration');

	// 初回（未設定）の場合はダイアログを表示
	if (gitIntegration === null) {
		const gitAdapter = new GitAdapter(workspaceRoot);

		// Gitリポジトリでない場合は無効化
		if (!gitAdapter.isGitRepository()) {
			await config.update('gitIntegration', false, vscode.ConfigurationTarget.Workspace);
			return null;
		}

		const result = await vscode.window.showInformationMessage(
			'Pahcer UIでGit統合を有効にしますか？\n' +
				'有効にすると、テスト実行前に自動的にコミットを作成し、後でバージョン間の差分を確認できます。',
			{ modal: true },
			'有効にする',
			'無効にする',
		);

		if (result === '有効にする') {
			await config.update('gitIntegration', true, vscode.ConfigurationTarget.Workspace);
			gitIntegration = true;
		} else {
			await config.update('gitIntegration', false, vscode.ConfigurationTarget.Workspace);
			gitIntegration = false;
		}
	}

	// Git統合が有効な場合はコミット
	if (gitIntegration === true) {
		try {
			const gitAdapter = new GitAdapter(workspaceRoot);
			const now = new Date();
			// Format as local time ISO format (YYYY-MM-DDTHH:mm:ss)
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
			const commitHash = await gitAdapter.commitAll(`Run at ${timestamp}`);

			vscode.window.showInformationMessage(`コミット作成: ${commitHash.slice(0, 7)}`);
			return commitHash;
		} catch (error) {
			vscode.window.showErrorMessage(`Git操作に失敗しました: ${error}`);
			throw error;
		}
	}

	return null;
}
