import * as vscode from 'vscode';
import { ConfigRepository } from '../infrastructure/configRepository';
import { InputFileRepository } from '../infrastructure/inputFileRepository';
import { PahcerResultRepository } from '../infrastructure/pahcerResultRepository';
import { StderrFileRepository } from '../infrastructure/stderrFileRepository';

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

/**
 * 比較ビューのコントローラ
 */
export class ComparisonViewController {
	private panel: vscode.WebviewPanel | undefined;
	private messageDisposable: vscode.Disposable | undefined;

	private resultRepository: PahcerResultRepository;
	private inputFileRepository: InputFileRepository;
	private stderrFileRepository: StderrFileRepository;
	private configRepository: ConfigRepository;

	constructor(
		private context: vscode.ExtensionContext,
		private workspaceRoot: string,
	) {
		this.resultRepository = new PahcerResultRepository(workspaceRoot);
		this.inputFileRepository = new InputFileRepository(workspaceRoot);
		this.stderrFileRepository = new StderrFileRepository(workspaceRoot);
		this.configRepository = new ConfigRepository(workspaceRoot);
	}

	/**
	 * 比較ビューを表示
	 */
	async showComparison(resultIds: string[]): Promise<void> {
		// Load result data
		const results: Array<{ id: string; data: any }> = [];
		for (const resultId of resultIds) {
			const result = await this.resultRepository.loadResult(resultId);
			if (result) {
				results.push({ id: resultId, data: result });
			}
		}

		if (results.length === 0) {
			// Close panel if no results selected
			if (this.panel) {
				this.panel.dispose();
			}
			return;
		}

		// Collect all seeds
		const allSeeds = new Set<number>();
		for (const result of results) {
			for (const testCase of result.data.cases) {
				allSeeds.add(testCase.seed);
			}
		}

		// Load input files and extract first line for features
		const inputData = await this.inputFileRepository.loadFirstLines(Array.from(allSeeds));

		// Load stderr files for all results and seeds
		const stderrData = await this.stderrFileRepository.loadStderrForResults(
			resultIds,
			Array.from(allSeeds),
		);

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

			// Handle messages from webview
			this.messageDisposable = this.panel.webview.onDidReceiveMessage(
				async (message) => {
					if (message.command === 'showVisualizer') {
						const { resultId, seed } = message;
						await vscode.commands.executeCommand('pahcer-ui.showVisualizer', seed, resultId);
					} else if (message.command === 'saveComparisonConfig') {
						await this.configRepository.save(message.config);
					}
				},
				undefined,
				this.context.subscriptions,
			);
		}

		// Generate HTML
		this.panel.webview.html = await this.getWebviewContent(
			results,
			inputData,
			stderrData,
			this.panel.webview,
		);
	}

	/**
	 * WebViewのHTMLを生成
	 */
	private async getWebviewContent(
		results: Array<{ id: string; data: any }>,
		inputData: Map<number, string>,
		stderrData: Record<string, Record<number, string>>,
		webview: vscode.Webview,
	): Promise<string> {
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

		// Convert inputData Map to object
		const inputDataObj: Record<number, string> = {};
		for (const [seed, firstLine] of inputData.entries()) {
			inputDataObj[seed] = firstLine;
		}

		// Load config
		const config = await this.configRepository.load();

		// Prepare data for React
		const comparisonData = {
			results: results.map((r) => ({
				id: r.id,
				time: formatDate(new Date(r.data.startTime)),
				cases: r.data.cases.map((c: any) => ({
					seed: c.seed,
					score: c.score,
					relativeScore: c.relativeScore,
					executionTime: c.executionTime,
				})),
			})),
			seeds,
			inputData: inputDataObj,
			stderrData,
			config,
		};

		// Get script URI
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'comparison.js'),
		);

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
