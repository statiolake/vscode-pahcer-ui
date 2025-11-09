import * as vscode from 'vscode';
import { GitAdapter } from './gitAdapter';

/**
 * pahcer実行後に結果ファイルをコミット（output + results + meta.json）
 * @param workspaceRoot ワークスペースルート
 * @param caseCount テストケース数
 * @param totalScore 総スコア
 */
export async function commitResultsAfterExecution(
	workspaceRoot: string,
	caseCount: number,
	totalScore: number,
): Promise<string | null> {
	const config = vscode.workspace.getConfiguration('pahcer-ui');
	const gitIntegration = config.get<boolean>('gitIntegration');

	// Git統合が無効な場合は何もしない
	if (gitIntegration !== true) {
		return null;
	}

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

		// 平均スコアを計算
		const averageScore = caseCount > 0 ? totalScore / caseCount : 0;

		// コミットメッセージを作成
		const message = `Results at ${timestamp} - ${caseCount} cases, total score: ${totalScore}, avg: ${averageScore.toFixed(2)}`;

		const commitHash = await gitAdapter.commitAll(message);

		vscode.window.showInformationMessage(`結果コミット作成: ${commitHash.slice(0, 7)}`);
		return commitHash;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showWarningMessage(`結果コミット作成に失敗しました: ${errorMessage}`);
		return null;
	}
}

/**
 * pahcer実行前にソースコードをコミット
 */
export async function commitSourceBeforeExecution(workspaceRoot: string): Promise<string | null> {
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

		const result = await vscode.window.showWarningMessage(
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
			await config.update('gitIntegration', true, vscode.ConfigurationTarget.Workspace);
			gitIntegration = true;
		} else {
			await config.update('gitIntegration', false, vscode.ConfigurationTarget.Workspace);
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

		vscode.window.showInformationMessage(`コミット作成: ${commitHash.slice(0, 7)}`);
		return commitHash;
	}

	return null;
}
