import * as vscode from 'vscode';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { TerminalAdapter } from '../../infrastructure/terminalAdapter';
import type { WorkspaceAdapter } from '../../infrastructure/workspaceAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export async function runCommand(
	workspaceAdapter: WorkspaceAdapter,
	terminalAdapter: TerminalAdapter,
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

	terminalAdapter.runPahcer(workspaceRoot);
}
