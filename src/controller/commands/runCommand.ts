import * as vscode from 'vscode';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';
import type { WorkspaceAdapter } from '../../infrastructure/workspaceAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export async function runCommand(
	workspaceAdapter: WorkspaceAdapter,
	taskAdapter: TaskAdapter,
): Promise<void> {
	const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

	if (!workspaceRoot) {
		vscode.window.showErrorMessage('ワークスペースが開かれていません');
		return;
	}

	// Git統合チェック＆コミット
	try {
		const commitHash = await checkAndCommitIfEnabled(workspaceRoot);
		if (commitHash) {
			// コミットハッシュをグローバル変数に保存（後でmeta.jsonに保存するため）
			(global as any).lastCommitHash = commitHash;
		}
	} catch (error) {
		// エラーメッセージは checkAndCommitIfEnabled 内で表示済み
		return;
	}

	await taskAdapter.runPahcer(workspaceRoot);
}
