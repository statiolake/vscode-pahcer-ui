import type { ConfigAdapter } from './configAdapter';
import type { DialogAdapter } from './dialogAdapter';
import { GitAdapter } from './gitAdapter';

/**
 * Git統合の設定を確認し、必要なら初回ダイアログを表示
 */
export async function checkAndCommitIfEnabled(
	workspaceRoot: string,
	configAdapter: ConfigAdapter,
	dialogAdapter: DialogAdapter,
): Promise<string | null> {
	let gitIntegration = configAdapter.getGitIntegration();

	// 初回（未設定）の場合はダイアログを表示
	if (gitIntegration === null) {
		const gitAdapter = new GitAdapter(workspaceRoot);

		// Gitリポジトリでない場合は無効化
		if (!gitAdapter.isGitRepository()) {
			await configAdapter.setGitIntegration(false);
			return null;
		}

		const result = await dialogAdapter.showWarningMessage(
			'Pahcer UIでGit統合を有効にしますか？',
			{
				modal: true,
				detail:
					'有効にすると、テスト実行前に自動的にコミットを作成し、後でバージョン間の差分を確認できます。\n\n' +
					'⚠️ 注意: ワークスペース内のすべての変更ファイルが自動的にコミットされます。' +
					'.gitignoreを注意深く確認し、コミットしたくないファイルが除外されていることを確認してください。',
			},
			{ title: '有効にする' },
			{ title: '無効にする', isCloseAffordance: true },
		);

		if (result !== undefined && result.title === '有効にする') {
			await configAdapter.setGitIntegration(true);
			gitIntegration = true;
		} else {
			await configAdapter.setGitIntegration(false);
			gitIntegration = false;
		}
	}

	// Git統合が有効な場合はコミット
	if (gitIntegration === true) {
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

		dialogAdapter.showInformationMessage(`コミット作成: ${commitHash.slice(0, 7)}`);
		return commitHash;
	}

	return null;
}
