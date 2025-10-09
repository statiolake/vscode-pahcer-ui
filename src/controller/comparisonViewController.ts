import * as vscode from 'vscode';
import { getLongTitle, type PahcerResult } from '../domain/models/pahcerResult';
import type { ResultMetadata } from '../domain/models/resultMetadata';
import { ConfigRepository } from '../infrastructure/configRepository';
import { MetadataRepository } from '../infrastructure/metadataRepository';
import { PahcerResultRepository } from '../infrastructure/pahcerResultRepository';

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
	private metadataRepository: MetadataRepository;
	private configRepository: ConfigRepository;

	constructor(
		private context: vscode.ExtensionContext,
		workspaceRoot: string,
	) {
		this.resultRepository = new PahcerResultRepository(workspaceRoot);
		this.metadataRepository = new MetadataRepository(workspaceRoot);
		this.configRepository = new ConfigRepository(workspaceRoot);
	}

	/**
	 * 比較ビューを表示
	 */
	async showComparison(resultIds: string[]): Promise<void> {
		// Load result data
		const results: Array<{ id: string; data: PahcerResult | null }> = [];
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

		// Load metadata for all results (contains analysis data)
		const metadataMap = new Map<string, ResultMetadata>();
		for (const resultId of resultIds) {
			const metadata = await this.metadataRepository.load(resultId);
			if (metadata) {
				metadataMap.set(resultId, metadata);
			}
		}

		// Filter out null results and prepare comparison data
		const validResults = results.filter(
			(r): r is { id: string; data: PahcerResult } => r.data !== null,
		);
		const comparisonData = await this.prepareComparisonData(validResults, metadataMap);

		// Create or update panel
		if (this.panel) {
			// Panel already exists - just update data without reloading
			this.panel.reveal(vscode.ViewColumn.One);
			this.panel.webview.postMessage({
				command: 'updateData',
				data: comparisonData,
			});
		} else {
			// Create new panel
			const extensionUri = this.context.extensionUri;

			this.panel = vscode.window.createWebviewPanel(
				'pahcerComparison',
				'結果の比較',
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

			// Set initial HTML
			this.panel.webview.html = this.getWebviewContent(comparisonData, this.panel.webview);
		}
	}

	/**
	 * 比較データを準備
	 */
	private async prepareComparisonData(
		results: Array<{ id: string; data: PahcerResult }>,
		metadataMap: Map<string, ResultMetadata>,
	) {
		// Collect all seeds
		const allSeeds = new Set<number>();
		for (const result of results) {
			for (const testCase of result.data.cases) {
				allSeeds.add(testCase.seed);
			}
		}
		const seeds = Array.from(allSeeds).sort((a, b) => a - b);

		// Build inputData and stderrData from metadata analysis
		const inputDataObj: Record<number, string> = {};
		const stderrData: Record<string, Record<number, Record<string, number>>> = {};

		for (const { id, data } of results) {
			const metadata = metadataMap.get(id);
			const analysis = metadata?.analysis || {};

			stderrData[id] = {};

			for (const testCase of data.cases) {
				const seed = testCase.seed;
				const seedAnalysis = analysis[seed];

				if (seedAnalysis) {
					// Use first input line from analysis
					if (!inputDataObj[seed]) {
						inputDataObj[seed] = seedAnalysis.firstInputLine || '';
					}

					// Use stderr variables from analysis
					stderrData[id][seed] = seedAnalysis.stderrVars || {};
				} else {
					// Fallback to empty
					if (!inputDataObj[seed]) {
						inputDataObj[seed] = '';
					}
					stderrData[id][seed] = {};
				}
			}
		}

		// Load config
		const config = await this.configRepository.load();

		// Prepare data for React
		return {
			results: results.map((r) => ({
				id: r.id,
				time: getLongTitle(r.data),
				cases: r.data.cases.map((c) => ({
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
	}

	/**
	 * WebViewのHTMLを生成
	 */
	private getWebviewContent(
		comparisonData: Awaited<ReturnType<typeof this.prepareComparisonData>>,
		webview: vscode.Webview,
	): string {
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
    <title>結果の比較</title>
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
