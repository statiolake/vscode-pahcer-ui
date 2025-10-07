import * as vscode from 'vscode';

/**
 * VSCodeワークスペース情報の取得を抽象化
 */
export class WorkspaceAdapter {
	/**
	 * ワークスペースルートのパスを取得
	 */
	getWorkspaceRoot(): string | undefined {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}

	/**
	 * ワークスペースが開かれているかチェック
	 */
	hasWorkspace(): boolean {
		return (
			vscode.workspace.workspaceFolders !== undefined &&
			vscode.workspace.workspaceFolders.length > 0
		);
	}
}
