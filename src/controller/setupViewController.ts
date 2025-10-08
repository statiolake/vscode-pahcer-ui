import * as vscode from 'vscode';
import { PahcerAdapter, PahcerStatus } from '../infrastructure/pahcerAdapter';

/**
 * セットアップビュー（インストールガイド or 初期化UI）
 */
export class SetupViewController implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspaceRoot: string,
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		const pahcerAdapter = new PahcerAdapter(this.workspaceRoot);
		const status = pahcerAdapter.checkStatus();

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};

		if (status === PahcerStatus.NotInstalled) {
			webviewView.webview.html = this.getInstallationGuideHtml(webviewView.webview);
			webviewView.webview.onDidReceiveMessage((message) => {
				if (message.command === 'openGitHub') {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/terry-u16/pahcer'));
				}
			});
		} else if (status === PahcerStatus.NotInitialized) {
			webviewView.webview.html = this.getInitializationHtml(webviewView.webview);
			webviewView.webview.onDidReceiveMessage(async (message) => {
				if (message.command === 'initialize') {
					await this.handleInitialize(message.options);
				}
			});
		}
	}

	private async handleInitialize(options: any): Promise<void> {
		let command = `pahcer init --problem "${options.problemName}" --objective ${options.objective} --lang ${options.language}`;
		if (options.isInteractive) {
			command += ' --interactive';
		}

		const terminal = vscode.window.createTerminal({
			name: 'Pahcer Init',
			cwd: this.workspaceRoot,
		});
		terminal.show();
		terminal.sendText(command);

		// Prompt to reload window
		setTimeout(() => {
			vscode.window
				.showInformationMessage(
					'初期化が完了しました。ウィンドウを再読み込みしてください。',
					'再読み込み',
				)
				.then((selection) => {
					if (selection === '再読み込み') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});
		}, 1000);
	}

	private getInstallationGuideHtml(webview: vscode.Webview): string {
		return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource};">
	<title>Pahcer インストールガイド</title>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		button {
			width: 100%;
			padding: 6px 14px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			cursor: pointer;
			font-family: var(--vscode-font-family);
			font-size: inherit;
			text-align: center;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		button:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
	</style>
</head>
<body>
	<h2 style="margin: 0 0 15px 0; font-size: 1.2em;">Pahcer がインストールされていません</h2>
	<p style="margin-bottom: 15px;">
		Pahcer UI を使用するには、pahcer コマンドラインツールをインストールする必要があります。
	</p>
	<p style="margin-bottom: 15px;">
		以下のボタンをクリックして、インストール方法を確認してください。
	</p>
	<button onclick="openGitHub()">Pahcer の GitHub ページを開く</button>
	<p style="margin-top: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
		インストール後、VS Code ウィンドウを再読み込みしてください。
	</p>
	<script>
		const vscode = acquireVsCodeApi();
		function openGitHub() {
			vscode.postMessage({ command: 'openGitHub' });
		}
	</script>
</body>
</html>`;
	}

	private getInitializationHtml(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'initialization.js'),
		);

		return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
	<title>Pahcer 初期化</title>
</head>
<body>
	<div id="root"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
	}
}
