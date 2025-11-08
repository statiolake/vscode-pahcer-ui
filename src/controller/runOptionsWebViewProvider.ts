import * as vscode from 'vscode';
import type { ConfigFileRepository } from '../infrastructure/configFileRepository';
import type { ContextAdapter } from '../infrastructure/contextAdapter';
import type { ExecutionRepository } from '../infrastructure/executionRepository';
import {
	commitResultsAfterExecution,
	commitSourceBeforeExecution,
} from '../infrastructure/gitIntegration';
import type { InOutRepository } from '../infrastructure/inOutRepository';
import type { TaskAdapter } from '../infrastructure/taskAdapter';

interface RunOptions {
	startSeed: number;
	endSeed: number;
	freezeBestScores: boolean;
}

export class RunOptionsWebViewProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspaceRoot: string,
		private readonly taskAdapter: TaskAdapter,
		private readonly inOutRepository: InOutRepository,
		private readonly executionRepository: ExecutionRepository,
		private readonly contextAdapter: ContextAdapter,
		private readonly configFileRepository: ConfigFileRepository,
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
				case 'runWithOptions':
					await this.runWithOptions(message.options);
					// Refresh tree view after run completes
					await vscode.commands.executeCommand('pahcer-ui.refresh');
					break;
				case 'cancelRunOptions':
					await this.cancel();
					break;
			}
		});
	}

	async runWithOptions(options: RunOptions): Promise<void> {
		// Git統合: 実行前にソースコードをコミット
		let commitHash: string | null = null;
		try {
			commitHash = await commitSourceBeforeExecution(this.workspaceRoot);
		} catch (error) {
			vscode.window.showErrorMessage(`gitの操作に失敗しました: ${error}`);
			return;
		}

		const tempConfigPath = await this.createTempConfig(options);

		let command = `pahcer run --setting-file "${tempConfigPath}"`;
		if (options.freezeBestScores) {
			command += ' --freeze-best-scores';
		}

		// Switch back to TreeView
		await this.contextAdapter.setShowRunOptions(false);

		// Execute pahcer run using task
		await this.taskAdapter.runTask('Pahcer Run', command, this.workspaceRoot);

		// Task completed - copy output files
		const latestExecution = await this.executionRepository.getLatestExecution();
		if (latestExecution) {
			// output ファイルをコピーして meta.json に commitHash を保存
			await this.inOutRepository.copyOutputFiles(
				latestExecution.id,
				latestExecution,
				commitHash || undefined,
			);

			// Git統合: 実行後に結果をコミット
			try {
				await commitResultsAfterExecution(this.workspaceRoot, latestExecution);
			} catch (error) {
				vscode.window.showErrorMessage(`結果コミットに失敗しました: ${error}`);
			}
		}
	}

	async cancel(): Promise<void> {
		// Switch back to TreeView
		await this.contextAdapter.setShowRunOptions(false);
	}

	private async createTempConfig(options: RunOptions): Promise<string> {
		// Read original config from infrastructure layer
		let configContent = this.configFileRepository.read();

		// Replace start_seed and end_seed
		configContent = configContent.replace(
			/start_seed\s*=\s*\d+/,
			`start_seed = ${options.startSeed}`,
		);
		configContent = configContent.replace(/end_seed\s*=\s*\d+/, `end_seed = ${options.endSeed}`);

		// Create temp config file via infrastructure layer
		return this.configFileRepository.createTempConfig(configContent);
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'runOptions.js'),
		);

		return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
	<title>実行オプション</title>
</head>
<body>
	<div id="root"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
	}
}
