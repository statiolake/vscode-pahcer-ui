import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ExecutionRepository } from '../infrastructure/executionRepository';
import { checkAndCommitIfEnabled } from '../infrastructure/gitIntegration';
import type { OutputFileRepository } from '../infrastructure/outputFileRepository';
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
		private readonly outputFileRepository: OutputFileRepository,
		private readonly executionRepository: ExecutionRepository,
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
		// Git統合チェック＆コミット
		let commitHash: string | null = null;
		try {
			commitHash = await checkAndCommitIfEnabled(this.workspaceRoot);
		} catch (error) {
			// エラーメッセージは checkAndCommitIfEnabled 内で表示済み
			return;
		}

		const tempConfigPath = await this.createTempConfig(options);

		let command = `pahcer run --setting-file "${tempConfigPath}"`;
		if (options.freezeBestScores) {
			command += ' --freeze-best-scores';
		}

		// Switch back to TreeView
		await vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', false);

		// Execute pahcer run using task
		await this.taskAdapter.runTask('Pahcer Run', command, this.workspaceRoot);

		// Task completed - copy output files
		const latestExecution = await this.executionRepository.getLatestExecution();
		if (latestExecution) {
			await this.outputFileRepository.copyOutputFiles(
				latestExecution.id,
				latestExecution,
				commitHash || undefined,
			);
		}
	}

	async cancel(): Promise<void> {
		// Switch back to TreeView
		await vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', false);
	}

	private async createTempConfig(options: RunOptions): Promise<string> {
		const originalConfigPath = path.join(this.workspaceRoot, 'pahcer_config.toml');

		if (!fs.existsSync(originalConfigPath)) {
			throw new Error(`pahcer_config.toml not found: ${originalConfigPath}`);
		}

		let configContent = fs.readFileSync(originalConfigPath, 'utf-8');

		// Replace start_seed and end_seed
		configContent = configContent.replace(
			/start_seed\s*=\s*\d+/,
			`start_seed = ${options.startSeed}`,
		);
		configContent = configContent.replace(/end_seed\s*=\s*\d+/, `end_seed = ${options.endSeed}`);

		// Write to temporary file in .pahcer-ui directory
		const tempDir = path.join(this.workspaceRoot, '.pahcer-ui');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const tempConfigPath = path.join(tempDir, 'temp_pahcer_config.toml');
		fs.writeFileSync(tempConfigPath, configContent, 'utf-8');

		return tempConfigPath;
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
