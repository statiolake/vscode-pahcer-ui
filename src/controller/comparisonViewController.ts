import * as vscode from 'vscode';
import { type Execution, getLongTitle } from '../domain/models/execution';
import type { ResultMetadata } from '../domain/models/resultMetadata';
import { calculateBestScoresFromTestCases } from '../domain/services/aggregationService';
import { ConfigRepository } from '../infrastructure/configRepository';
import { ExecutionRepository } from '../infrastructure/executionRepository';
import { MetadataRepository } from '../infrastructure/metadataRepository';
import { SettingsRepository } from '../infrastructure/settingsRepository';
import { TestCaseRepository } from '../infrastructure/testCaseRepository';

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

	private executionRepository: ExecutionRepository;
	private testCaseRepository: TestCaseRepository;
	private metadataRepository: MetadataRepository;
	private configRepository: ConfigRepository;
	private settingsRepository: SettingsRepository;

	constructor(
		private context: vscode.ExtensionContext,
		workspaceRoot: string,
	) {
		this.executionRepository = new ExecutionRepository(workspaceRoot);
		this.testCaseRepository = new TestCaseRepository(workspaceRoot);
		this.metadataRepository = new MetadataRepository(workspaceRoot);
		this.configRepository = new ConfigRepository(workspaceRoot);
		this.settingsRepository = new SettingsRepository(workspaceRoot);
	}

	/**
	 * 比較ビューを表示
	 */
	async showComparison(executionIds: string[]): Promise<void> {
		// Load execution data
		const executions: Execution[] = [];
		for (const executionId of executionIds) {
			const execution = await this.executionRepository.loadExecution(executionId);
			if (execution) {
				executions.push(execution);
			}
		}

		if (executions.length === 0) {
			// Close panel if no results selected
			if (this.panel) {
				this.panel.dispose();
			}
			return;
		}

		// Load metadata for all results (contains analysis data)
		const metadataMap = new Map<string, ResultMetadata>();
		for (const executionId of executionIds) {
			const metadata = await this.metadataRepository.load(executionId);
			if (metadata) {
				metadataMap.set(executionId, metadata);
			}
		}

		const comparisonData = await this.prepareComparisonData(executions, metadataMap);

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
		executions: Execution[],
		metadataMap: Map<string, ResultMetadata>,
	) {
		// Load test cases and settings
		const testCases = await this.testCaseRepository.loadAllTestCases();
		const settings = await this.settingsRepository.loadSettings();

		// Calculate best scores
		const bestScores = calculateBestScoresFromTestCases(testCases, settings.objective);

		// Collect all seeds for selected executions
		const executionIds = new Set(executions.map((e) => e.id));
		const allSeeds = new Set<number>();
		for (const testCase of testCases) {
			if (executionIds.has(testCase.executionId)) {
				allSeeds.add(testCase.seed);
			}
		}
		const seeds = Array.from(allSeeds).sort((a, b) => a - b);

		// Build inputData and stderrData from metadata analysis
		const inputDataObj: Record<number, string> = {};
		const stderrData: Record<string, Record<number, Record<string, number>>> = {};

		for (const execution of executions) {
			const metadata = metadataMap.get(execution.id);
			const analysis = metadata?.analysis || {};

			stderrData[execution.id] = {};

			// Get test cases for this execution
			const executionTestCases = testCases.filter((tc) => tc.executionId === execution.id);

			for (const testCase of executionTestCases) {
				const seed = testCase.seed;
				const seedAnalysis = analysis[seed];

				if (seedAnalysis) {
					// Use first input line from analysis
					if (!inputDataObj[seed]) {
						inputDataObj[seed] = seedAnalysis.firstInputLine || '';
					}

					// Use stderr variables from analysis
					stderrData[execution.id][seed] = seedAnalysis.stderrVars || {};
				} else {
					// Fallback to empty
					if (!inputDataObj[seed]) {
						inputDataObj[seed] = '';
					}
					stderrData[execution.id][seed] = {};
				}
			}
		}

		// Load config
		const config = await this.configRepository.load();

		// Prepare data for React
		return {
			results: executions.map((execution) => ({
				id: execution.id,
				time: getLongTitle(execution),
				cases: testCases
					.filter((tc) => tc.executionId === execution.id)
					.map((tc) => {
						// Calculate relative score
						const bestScore = bestScores.get(tc.seed);
						let relativeScore = 0;
						if (tc.score > 0 && bestScore !== undefined) {
							if (settings.objective === 'max') {
								relativeScore = (tc.score / bestScore) * 100;
							} else {
								relativeScore = (bestScore / tc.score) * 100;
							}
						}

						return {
							seed: tc.seed,
							score: tc.score,
							relativeScore,
							executionTime: tc.executionTime,
						};
					}),
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
