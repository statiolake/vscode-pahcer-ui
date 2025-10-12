import * as vscode from 'vscode';

/**
 * VSCodeエディタ操作を抽象化するアダプター
 *
 * インフラ層の責務:
 * - VSCode APIの直接呼び出しを隠蔽
 * - エラーハンドリング
 */
export class EditorAdapter {
	/**
	 * 指定されたパスのファイルをエディタで開く
	 *
	 * @param filePath - 開くファイルの絶対パス
	 * @returns 成功した場合true、失敗した場合false
	 */
	async openFile(filePath: string): Promise<void> {
		const document = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(document);
	}

	/**
	 * エラーメッセージを表示
	 */
	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}
}
