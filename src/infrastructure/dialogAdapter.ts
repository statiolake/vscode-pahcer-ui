import * as vscode from 'vscode';

/**
 * VSCodeダイアログ操作を抽象化するアダプター
 *
 * インフラ層の責務:
 * - VSCode UI API (vscode.window.show*) の直接呼び出しを隠蔽
 * - ダイアログ操作の一元管理
 * - テスタビリティの向上
 */
export class DialogAdapter {
	/**
	 * エラーメッセージを表示
	 */
	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	/**
	 * 警告メッセージを表示（ボタン付き）
	 */
	async showWarningMessage<T extends vscode.MessageItem>(
		message: string,
		options?: vscode.MessageOptions,
		...items: T[]
	): Promise<T | undefined> {
		if (options !== undefined) {
			return await vscode.window.showWarningMessage(message, options, ...items);
		}
		return await vscode.window.showWarningMessage(message, ...items);
	}

	/**
	 * 情報メッセージを表示
	 */
	showInformationMessage(message: string): void {
		vscode.window.showInformationMessage(message);
	}

	/**
	 * 入力ボックスを表示
	 */
	async showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
		return await vscode.window.showInputBox(options);
	}

	/**
	 * クイックピックを表示
	 */
	async showQuickPick<T extends vscode.QuickPickItem>(
		items: T[] | Thenable<T[]>,
		options?: vscode.QuickPickOptions,
	): Promise<T | undefined> {
		return await vscode.window.showQuickPick(items, options);
	}

	/**
	 * プログレス付きで非同期処理を実行
	 */
	async withProgress<T>(
		options: vscode.ProgressOptions,
		task: (
			progress: vscode.Progress<{ message?: string; increment?: number }>,
			token: vscode.CancellationToken,
		) => Thenable<T>,
	): Promise<T> {
		return await vscode.window.withProgress(options, task);
	}
}
