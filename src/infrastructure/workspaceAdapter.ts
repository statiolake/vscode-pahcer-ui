import * as path from 'node:path';
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

	/**
	 * ワークスペース名（ディレクトリ名）を取得
	 */
	getWorkspaceName(): string | undefined {
		const root = this.getWorkspaceRoot();
		return root ? path.basename(root) : undefined;
	}
}
