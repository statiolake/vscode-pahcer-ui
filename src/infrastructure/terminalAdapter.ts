import * as vscode from 'vscode';

/**
 * VSCodeターミナル操作を抽象化
 */
export class TerminalAdapter {
	/**
	 * 新しいターミナルを作成してコマンドを実行
	 */
	runCommand(name: string, command: string, cwd?: string): vscode.Terminal {
		const terminal = vscode.window.createTerminal({
			name,
			cwd,
		});

		terminal.show();
		terminal.sendText(command);

		return terminal;
	}

	/**
	 * pahcer runを実行
	 */
	runPahcer(workspaceRoot: string): vscode.Terminal {
		return this.runCommand('Pahcer Run', 'pahcer run', workspaceRoot);
	}
}
