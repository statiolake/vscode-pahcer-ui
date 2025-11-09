import * as vscode from 'vscode';

/**
 * pahcer の GitHub リポジトリを開くコマンドハンドラ
 */
export function openGitHubCommand(): () => void {
	return () => {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/terry-u16/pahcer'));
	};
}
