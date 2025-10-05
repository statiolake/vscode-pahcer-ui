import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

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

	constructor(
		private context: vscode.ExtensionContext,
		private workspaceRoot: string,
	) {}

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

		if (results.length < 2) {
			vscode.window.showErrorMessage('比較するには2つ以上の実行結果を選択してください');
			return;
		}

		// Create or show panel
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
		} else {
			this.panel = vscode.window.createWebviewPanel(
				'pahcerComparison',
				'Results Comparison',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
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
					}
				},
				undefined,
				this.context.subscriptions,
			);
		}

		// Generate HTML with Chart.js
		this.panel.webview.html = this.getWebviewContent(results);
	}

	private getWebviewContent(results: Array<{ id: string; data: PahcerResult }>): string {
		// Collect all seeds
		const allSeeds = new Set<number>();
		for (const result of results) {
			for (const testCase of result.data.cases) {
				allSeeds.add(testCase.seed);
			}
		}
		const seeds = Array.from(allSeeds).sort((a, b) => a - b);

		// Prepare datasets for Chart.js
		const datasets: Array<{
			label: string;
			data: Array<{ x: number; y: number; resultId: string; seed: number }>;
			borderColor: string;
			backgroundColor: string;
		}> = [];

		const colors = [
			'rgb(255, 99, 132)',
			'rgb(54, 162, 235)',
			'rgb(255, 206, 86)',
			'rgb(75, 192, 192)',
			'rgb(153, 102, 255)',
			'rgb(255, 159, 64)',
		];

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const color = colors[i % colors.length];
			const time = new Date(result.data.start_time).toLocaleString();

			datasets.push({
				label: `${time}`,
				data: seeds.map((seed) => {
					const testCase = result.data.cases.find((c) => c.seed === seed);
					return {
						x: seed,
						y: testCase?.score || 0,
						resultId: result.id,
						seed,
					};
				}),
				borderColor: color,
				backgroundColor: color,
			});
		}

		const datasetsJson = JSON.stringify(datasets);
		const seedsJson = JSON.stringify(seeds);

		return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Results Comparison</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .controls {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.active {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        #chartContainer {
            position: relative;
            height: 600px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>実行結果の比較</h1>
    <div class="controls">
        <button id="absoluteBtn" class="active">絶対スコア</button>
        <button id="relativeBtn">相対スコア</button>
    </div>
    <div id="chartContainer">
        <canvas id="chart"></canvas>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const datasets = ${datasetsJson};
        const seeds = ${seedsJson};

        let currentMode = 'absolute';
        let chart;

        function createChart(mode) {
            const ctx = document.getElementById('chart').getContext('2d');

            if (chart) {
                chart.destroy();
            }

            // Prepare data based on mode
            const resultData = ${JSON.stringify(
							results.map((r) => ({
								id: r.id,
								cases: r.data.cases.map((c) => ({
									seed: c.seed,
									score: c.score,
									relativeScore: c.relative_score,
								})),
							})),
						)};

            const chartDatasets = datasets.map((ds, index) => {
                const result = resultData[index];
                const data = seeds.map(seed => {
                    const testCase = result.cases.find(c => c.seed === seed);
                    if (!testCase) {
                        return { x: seed, y: 0, resultId: result.id, seed };
                    }
                    return {
                        x: seed,
                        y: mode === 'absolute' ? testCase.score : testCase.relativeScore,
                        resultId: result.id,
                        seed
                    };
                });

                return {
                    label: ds.label,
                    borderColor: ds.borderColor,
                    backgroundColor: ds.backgroundColor,
                    data
                };
            });

            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: seeds,
                    datasets: chartDatasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const element = elements[0];
                            const datasetIndex = element.datasetIndex;
                            const index = element.index;
                            const point = chartDatasets[datasetIndex].data[index];

                            vscode.postMessage({
                                command: 'showVisualizer',
                                resultId: point.resultId,
                                seed: point.seed
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: 'var(--vscode-foreground)'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const point = context.raw;
                                    return context.dataset.label + ': ' + point.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Seed',
                                color: 'var(--vscode-foreground)'
                            },
                            ticks: {
                                color: 'var(--vscode-foreground)'
                            },
                            grid: {
                                color: 'var(--vscode-panel-border)'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: mode === 'absolute' ? 'スコア' : '相対スコア (%)',
                                color: 'var(--vscode-foreground)'
                            },
                            ticks: {
                                color: 'var(--vscode-foreground)'
                            },
                            grid: {
                                color: 'var(--vscode-panel-border)'
                            }
                        }
                    }
                }
            });
        }

        // Initial chart
        createChart('absolute');

        // Button handlers
        document.getElementById('absoluteBtn').addEventListener('click', () => {
            currentMode = 'absolute';
            document.getElementById('absoluteBtn').classList.add('active');
            document.getElementById('relativeBtn').classList.remove('active');
            createChart('absolute');
        });

        document.getElementById('relativeBtn').addEventListener('click', () => {
            currentMode = 'relative';
            document.getElementById('relativeBtn').classList.add('active');
            document.getElementById('absoluteBtn').classList.remove('active');
            createChart('relative');
        });
    </script>
</body>
</html>`;
	}
}
