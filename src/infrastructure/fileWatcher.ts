import * as vscode from 'vscode';

/**
 * ファイル監視を抽象化
 */
export class FileWatcher {
	private watcher: vscode.FileSystemWatcher;

	constructor(
		workspaceRoot: string,
		pattern: string,
		private handlers: {
			onCreate?: (uri: vscode.Uri) => void;
			onChange?: (uri: vscode.Uri) => void;
			onDelete?: (uri: vscode.Uri) => void;
		},
	) {
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(workspaceRoot, pattern),
		);

		if (handlers.onCreate) {
			this.watcher.onDidCreate(handlers.onCreate);
		}
		if (handlers.onChange) {
			this.watcher.onDidChange(handlers.onChange);
		}
		if (handlers.onDelete) {
			this.watcher.onDidDelete(handlers.onDelete);
		}
	}

	/**
	 * 監視を停止
	 */
	dispose(): void {
		this.watcher.dispose();
	}
}
