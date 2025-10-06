import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ConfigManager } from './configManager';

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

interface PahcerResult {
	start_time: string;
	case_count: number;
	total_score: number;
	total_score_log10: number;
	total_relative_score: number;
	max_execution_time: number;
	comment: string;
	tag_name: string | null;
	wa_seeds: number[];
	cases: Array<{
		seed: number;
		score: number;
		relative_score: number;
		execution_time: number;
		error_message: string;
	}>;
}

export class ComparisonView {
	private panel: vscode.WebviewPanel | undefined;
	private messageDisposable: vscode.Disposable | undefined;
	private configManager: ConfigManager;

	constructor(
		private context: vscode.ExtensionContext,
		private workspaceRoot: string,
	) {
		this.configManager = new ConfigManager(workspaceRoot);
	}

	private loadInputData(results: Array<{ id: string; data: PahcerResult }>): Map<number, string> {
		const inputMap = new Map<number, string>();
		const inputDir = path.join(this.workspaceRoot, 'tools', 'in');

		// Collect all seeds
		const seeds = new Set<number>();
		for (const result of results) {
			for (const testCase of result.data.cases) {
				seeds.add(testCase.seed);
			}
		}

		// Load first line of each input file
		for (const seed of seeds) {
			const inputPath = path.join(inputDir, `${String(seed).padStart(4, '0')}.txt`);
			if (fs.existsSync(inputPath)) {
				try {
					const content = fs.readFileSync(inputPath, 'utf-8');
					const firstLine = content.split('\n')[0].trim();
					inputMap.set(seed, firstLine);
				} catch (e) {
					console.error(`Failed to read input file for seed ${seed}:`, e);
				}
			}
		}

		return inputMap;
	}

	async showComparison(resultIds: string[]) {
		// Load result data
		const results: Array<{ id: string; data: PahcerResult }> = [];
		for (const resultId of resultIds) {
			const jsonPath = path.join(this.workspaceRoot, 'pahcer', 'json', `result_${resultId}.json`);
			if (fs.existsSync(jsonPath)) {
				const content = fs.readFileSync(jsonPath, 'utf-8');
				const data = JSON.parse(content);
				results.push({ id: resultId, data });
			}
		}

		if (results.length === 0) {
			// Close panel if no results selected
			if (this.panel) {
				this.panel.dispose();
			}
			return;
		}

		// Load input files and extract first line for features
		const inputData = this.loadInputData(results);

		// Create or show panel
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
		} else {
			const extensionUri = this.context.extensionUri;

			this.panel = vscode.window.createWebviewPanel(
				'pahcerComparison',
				'Results Comparison',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
				},
			);

			this.panel.onDidDispose(() => {
				this.panel = undefined;
				if (this.messageDisposable) {
					this.messageDisposable.dispose();
					this.messageDisposable = undefined;
				}
			});

			// Handle messages from webview (only register once)
			this.messageDisposable = this.panel.webview.onDidReceiveMessage(
				async (message) => {
					if (message.command === 'showVisualizer') {
						const { resultId, seed } = message;
						await vscode.commands.executeCommand('vscode-pahcer-ui.showVisualizer', seed, resultId);
					} else if (message.command === 'saveFeatures') {
						this.configManager.setFeatures(message.features);
					} else if (message.command === 'saveXAxis') {
						this.configManager.setXAxis(message.xAxis);
					} else if (message.command === 'saveYAxis') {
						this.configManager.setYAxis(message.yAxis);
					} else if (message.command === 'getConfig') {
						const config = this.configManager.getConfig();
						this.panel?.webview.postMessage({
							command: 'configLoaded',
							config,
						});
					}
				},
				undefined,
				this.context.subscriptions,
			);
		}

		// Generate HTML with Chart.js
		this.panel.webview.html = this.getWebviewContent(results, inputData, this.panel.webview);
	}

	private getWebviewContent(
		results: Array<{ id: string; data: PahcerResult }>,
		inputData: Map<number, string>,
		webview: vscode.Webview,
	): string {
		// Format execution time
		function formatDate(date: Date): string {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hour = String(date.getHours()).padStart(2, '0');
			const minute = String(date.getMinutes()).padStart(2, '0');
			const second = String(date.getSeconds()).padStart(2, '0');
			return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
		}

		// Collect all seeds
		const allSeeds = new Set<number>();
		for (const result of results) {
			for (const testCase of result.data.cases) {
				allSeeds.add(testCase.seed);
			}
		}
		const seeds = Array.from(allSeeds).sort((a, b) => a - b);

		// Convert inputData Map to object for JSON serialization
		const inputDataObj: Record<number, string> = {};
		for (const [seed, firstLine] of inputData.entries()) {
			inputDataObj[seed] = firstLine;
		}

		// Prepare data for React
		const comparisonData = {
			results: results.map((r) => ({
				id: r.id,
				time: formatDate(new Date(r.data.start_time)),
				cases: r.data.cases.map((c) => ({
					seed: c.seed,
					score: c.score,
					relativeScore: c.relative_score,
				})),
			})),
			seeds,
			inputData: inputDataObj,
			config: this.configManager.getConfig(),
		};

		// Get script URI
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'comparison.js'),
		);

		// Generate nonce for inline scripts
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
    <title>Results Comparison</title>
    <style nonce="${nonce}">
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.initialData = ${JSON.stringify(comparisonData)};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}
