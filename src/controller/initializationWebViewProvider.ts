import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ConfigFileRepository } from '../infrastructure/configFileRepository';
import type { ContextAdapter } from '../infrastructure/contextAdapter';
import type { GitignoreAdapter } from '../infrastructure/gitignoreAdapter';
import type { TaskAdapter } from '../infrastructure/taskAdapter';
import { TesterDownloader } from '../infrastructure/testerDownloader';

interface InitOptions {
	problemName: string;
	objective: 'max' | 'min';
	language: 'rust' | 'cpp' | 'python' | 'go';
	isInteractive: boolean;
	testerUrl: string;
}

/**
 * pahcer init を実行するための初期化WebView
 */
export class InitializationWebViewProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspaceRoot: string,
		private readonly taskAdapter: TaskAdapter,
		private readonly contextAdapter: ContextAdapter,
		private readonly configFileRepository: ConfigFileRepository,
		private readonly gitignoreAdapter: GitignoreAdapter,
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};

		webviewView.webview.html = this.getHtmlContent(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case 'initialize':
					await this.handleInitialize(message.options);
					break;
			}
		});
	}

	private async handleInitialize(options: InitOptions): Promise<void> {
		let finalIsInteractive = options.isInteractive;

		// Download tester if URL is provided
		if (options.testerUrl) {
			try {
				vscode.window.showInformationMessage('ローカルテスターをダウンロード中...');
				const downloader = new TesterDownloader(this.workspaceRoot);
				await downloader.downloadAndExtract(options.testerUrl);
				vscode.window.showInformationMessage('ローカルテスターのダウンロードが完了しました。');

				// Check if tester suggests interactive problem
				const hasInteractiveTester = this.configFileRepository.hasTester();

				// If detected interactive status differs from user selection, confirm
				if (hasInteractiveTester !== options.isInteractive) {
					const detectedType = hasInteractiveTester
						? 'インタラクティブ問題'
						: '非インタラクティブ問題';
					const userSelectedType = options.isInteractive
						? 'インタラクティブ'
						: '非インタラクティブ';

					const result = await vscode.window.showWarningMessage(
						'検出されたインタラクティブ設定に変更しますか？',
						{
							modal: true,
							detail:
								`ダウンロードされたローカルテスターの構成から、指定と異なる問題タイプが検出されました。\n\n` +
								`指定された問題タイプ: ${userSelectedType}\n` +
								`検出された問題タイプ: ${detectedType}\n\n` +
								`検出された問題タイプで続けますか？`,
						},
						{ title: hasInteractiveTester ? 'インタラクティブに変更' : '非インタラクティブに変更' },
						{ title: 'このまま続行', isCloseAffordance: true },
					);

					if (result !== undefined && result.title !== 'このまま続行') {
						finalIsInteractive = hasInteractiveTester;
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(
					`ローカルテスターのダウンロードに失敗しました: ${errorMessage}`,
				);
			}
		}

		// Update .gitignore to add tools/target
		this.updateGitignore();

		// Close initialization WebView and return to TreeView
		await this.contextAdapter.setShowInitialization(false);

		// Execute pahcer init using task
		await this.taskAdapter.runPahcerInit(
			this.workspaceRoot,
			options.problemName,
			options.objective,
			options.language,
			finalIsInteractive,
		);

		// Wait a moment for the command to execute, then refresh TreeView
		setTimeout(async () => {
			await vscode.commands.executeCommand('pahcer-ui.refresh');
		}, 2000);
	}

	/**
	 * .gitignore に tools/target を追加
	 */
	private updateGitignore(): void {
		try {
			this.gitignoreAdapter.addEntry('tools/target');
		} catch (error) {
			// Silently ignore errors - not critical
			console.error('Failed to update .gitignore:', error);
		}
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'initialization.js'),
		);

		// Get current directory name as default project name
		const defaultProjectName = path.basename(this.workspaceRoot) || 'project';

		return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
	<title>Pahcer 初期化</title>
</head>
<body>
	<div id="root" data-default-project-name="${defaultProjectName}"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
	}
}
