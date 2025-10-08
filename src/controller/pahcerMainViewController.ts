import * as vscode from 'vscode';
import { PahcerAdapter, PahcerStatus } from '../infrastructure/pahcerAdapter';

/**
 * Pahcerメインビューコントローラ
 * pahcerの状態に応じて、インストールガイド/初期化UI/TreeViewを切り替える
 */
export class PahcerMainViewController implements vscode.WebviewViewProvider {
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
			webviewView.webview.html = this.getInstallationGuideHtml();
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

		// Reload window after initialization
		vscode.window
			.showInformationMessage(
				'Pahcerの初期化が完了しました。ウィンドウを再読み込みしてください。',
				'再読み込み',
			)
			.then((selection) => {
				if (selection === '再読み込み') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			});
	}

	private getInstallationGuideHtml(): string {
		return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Pahcer インストールガイド</title>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
		}
		h1 {
			font-size: 1.5em;
			margin-bottom: 1em;
		}
		p {
			margin-bottom: 1em;
			line-height: 1.6;
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<h1>Pahcer がインストールされていません</h1>
	<p>
		Pahcer UI を使用するには、pahcer コマンドラインツールをインストールする必要があります。
	</p>
	<p>
		以下のリンクにアクセスして、インストール方法を確認してください：
	</p>
	<p>
		<a href="https://github.com/terry-u16/pahcer">https://github.com/terry-u16/pahcer</a>
	</p>
	<p>
		インストール後、VS Code ウィンドウを再読み込みしてください。
	</p>
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
