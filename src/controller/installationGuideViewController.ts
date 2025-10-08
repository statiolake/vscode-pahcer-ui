import type * as vscode from 'vscode';

/**
 * pahcerがインストールされていない場合のガイドビュー
 */
export class InstallationGuideViewController implements vscode.WebviewViewProvider {
	constructor(private readonly context: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		webviewView.webview.options = {
			enableScripts: false,
		};

		webviewView.webview.html = this.getHtmlContent();
	}

	private getHtmlContent(): string {
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
		.code {
			background: var(--vscode-textCodeBlock-background);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
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
		インストール後、VS Code を再読み込みしてください。
	</p>
</body>
</html>`;
	}
}
