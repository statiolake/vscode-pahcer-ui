import * as vscode from 'vscode';
import type { ContextAdapter } from '../infrastructure/contextAdapter';
import type { PahcerAdapter } from '../infrastructure/pahcerAdapter';

interface RunOptions {
	startSeed: number;
	endSeed: number;
	freezeBestScores: boolean;
}

export class RunOptionsWebViewProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly pahcerAdapter: PahcerAdapter,
		private readonly contextAdapter: ContextAdapter,
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
		try {
			// Switch back to TreeView
			await this.contextAdapter.setShowRunOptions(false);

			// Execute pahcer run with options
			await this.pahcerAdapter.run({
				startSeed: options.startSeed,
				endSeed: options.endSeed,
				freezeBestScores: options.freezeBestScores,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
		}
	}

	async cancel(): Promise<void> {
		// Switch back to TreeView
		await this.contextAdapter.setShowRunOptions(false);
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
