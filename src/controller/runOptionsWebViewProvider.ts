import * as fs from 'node:fs';
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
import { TestCaseRepository } from '../infrastructure/testCaseRepository';

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

	private async runWithOptions(options: RunOptions): Promise<void> {
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
				const testCaseRepository = new TestCaseRepository(this.workspaceRoot);
				const allTestCases = await testCaseRepository.loadAllTestCases();
				const executionTestCases = allTestCases.filter(
					(tc) => tc.executionId === latestExecution.id,
				);
				const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);
				await commitResultsAfterExecution(
					this.workspaceRoot,
					executionTestCases.length,
					totalScore,
				);
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

		// Create temp file with modified config
		const tempDir = this.workspaceRoot;
		const tempFilePath = `${tempDir}/.pahcer-temp-config.toml`;
		fs.writeFileSync(tempFilePath, configContent);

		return tempFilePath;
	}

	private getHtmlContent(_webview: vscode.Webview): string {
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Pahcer Run Options</title>
				<style>
					body {
						font-family: var(--vscode-font-family);
						padding: 20px;
					}
					.form-group {
						margin-bottom: 15px;
					}
					label {
						display: block;
						margin-bottom: 5px;
					}
					input[type="number"] {
						width: 100%;
						padding: 5px;
					}
					button {
						padding: 10px 20px;
						margin-right: 10px;
					}
				</style>
			</head>
			<body>
				<h2>Pahcer Run Options</h2>
				<div class="form-group">
					<label for="startSeed">Start Seed:</label>
					<input type="number" id="startSeed" value="1" min="1">
				</div>
				<div class="form-group">
					<label for="endSeed">End Seed:</label>
					<input type="number" id="endSeed" value="100" min="1">
				</div>
				<div class="form-group">
					<label>
						<input type="checkbox" id="freezeBestScores">
						Freeze Best Scores
					</label>
				</div>
				<button onclick="run()">Run</button>
				<button onclick="cancel()">Cancel</button>

				<script>
					const vscode = acquireVsCodeApi();

					function run() {
						const options = {
							startSeed: parseInt(document.getElementById('startSeed').value),
							endSeed: parseInt(document.getElementById('endSeed').value),
							freezeBestScores: document.getElementById('freezeBestScores').checked
						};
						vscode.postMessage({ command: 'runWithOptions', options });
					}

					function cancel() {
						vscode.postMessage({ command: 'cancelRunOptions' });
					}
				</script>
			</body>
			</html>
		`;
	}
}
