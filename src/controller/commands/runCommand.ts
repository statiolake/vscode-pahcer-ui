import * as vscode from 'vscode';
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

	terminalAdapter.runPahcer(workspaceRoot);
}
