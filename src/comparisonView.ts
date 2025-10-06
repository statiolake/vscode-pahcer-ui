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

// Generate consistent color from result ID
function getColorForResultId(resultId: string): string {
	let hash = 0;
	for (let i = 0; i < resultId.length; i++) {
		hash = resultId.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = Math.abs(hash % 360);
	const saturation = 70 + (Math.abs(hash >> 8) % 20); // 70-90%
	const lightness = 50 + (Math.abs(hash >> 16) % 20); // 50-70%

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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

		for (const result of results) {
			const color = getColorForResultId(result.id);
			const time = formatDate(new Date(result.data.start_time));

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

		// Convert inputData Map to object for JSON serialization
		const inputDataObj: Record<number, string> = {};
		for (const [seed, firstLine] of inputData.entries()) {
			inputDataObj[seed] = firstLine;
		}
		const inputDataJson = JSON.stringify(inputDataObj);

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

		// Get Chart.js URI
		const chartJsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'chart.js'),
		);

		// Generate nonce for inline scripts
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Results Comparison</title>
    <script src="${chartJsUri}"></script>
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
        input, select {
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        label {
            margin-right: 10px;
        }
        .section {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
            font-weight: bold;
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

    <div class="section">
        <label>
            Features:
            <input type="text" id="featuresInput" placeholder="例: N M K" style="width: 300px;">
        </label>
        <p style="font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            入力ファイルの先頭行を空白区切りで解釈します (例: N M K)。変更すると自動保存されます。
        </p>
    </div>

    <div class="section">
        <h3>統計情報</h3>
        <table id="statsTable">
            <thead>
                <tr>
                    <th>実行</th>
                    <th>スコア合計</th>
                    <th>Mean ± SD</th>
                    <th>#Best</th>
                    <th>#Unique</th>
                    <th>#Fail</th>
                </tr>
            </thead>
            <tbody id="statsTableBody"></tbody>
        </table>
    </div>

    <div class="section">
        <h3>グラフ設定</h3>
        <div class="controls">
            <label>
                Type:
                <select id="chartType">
                    <option value="line">Line</option>
                    <option value="scatter">Scatter</option>
                </select>
            </label>
            <label>
                X軸:
                <input type="text" id="xAxisInput" placeholder="例: seed, N, log(N)" style="width: 200px;">
            </label>
            <label>
                Y軸:
                <select id="yAxisSelector">
                    <option value="absolute">絶対スコア</option>
                    <option value="relative">相対スコア</option>
                </select>
            </label>
            <label>
                <input type="checkbox" id="skipFailed" checked>
                Skip Failed
            </label>
        </div>
        <p style="font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            X軸には式を使用できます (例: seed, N, log(N), N^2, 2*N)
        </p>
    </div>

    <div id="chartContainer">
        <canvas id="chart"></canvas>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const datasets = ${datasetsJson};
        const seeds = ${seedsJson};
        const inputData = ${inputDataJson};
        const resultData = ${JSON.stringify(
					results.map((r) => ({
						id: r.id,
						time: formatDate(new Date(r.data.start_time)),
						cases: r.data.cases.map((c) => ({
							seed: c.seed,
							score: c.score,
							relativeScore: c.relative_score,
						})),
					})),
				)};

        let currentYAxis = 'absolute';
        let currentChartType = 'line';
        let currentXAxis = 'seed';
        let skipFailed = true;
        let chart;
        let features = [];

        // Load config
        vscode.postMessage({ command: 'getConfig' });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'configLoaded') {
                const config = message.config || {};
                document.getElementById('featuresInput').value = config.features || '';
                document.getElementById('xAxisInput').value = config.xAxis || 'seed';
                document.getElementById('yAxisSelector').value = config.yAxis || 'absolute';

                parseFeatures(config.features || '');
                currentXAxis = config.xAxis || 'seed';
                currentYAxis = config.yAxis || 'absolute';

                updateStats();
                createChart();
            }
        });

        function parseFeatures(featureStr) {
            features = featureStr.trim().split(/s+/).filter(f => f.length > 0);
        }

        function parseInputLine(seed) {
            const line = inputData[seed];
            const parsed = { seed: seed };

            if (!line) {
                return parsed;
            }

            const values = line.split(/s+/).filter(v => v.length > 0);
            for (let i = 0; i < Math.min(features.length, values.length); i++) {
                const num = parseFloat(values[i]);
                parsed[features[i]] = isNaN(num) ? 0 : num;
            }
            return parsed;
        }

        function evaluateExpression(expr, variables) {
            try {
                // Simple expression evaluator without eval
                let expression = expr.trim();

                // Sort variables by name length (longest first) to avoid partial replacements
                const sortedVars = Object.entries(variables).sort((a, b) => b[0].length - a[0].length);

                // Replace variables with their values
                for (const [name, value] of sortedVars) {
                    // Escape special regex characters in variable name
                    const regex = new RegExp('\\\\b' + name + '\\\\b', 'g');
                    expression = expression.replace(regex, String(value));
                }

                // Handle log(x) function
                expression = expression.replace(/logs*(([^)]+))/g, (match, arg) => {
                    const argValue = parseFloat(arg);
                    return String(Math.log(argValue));
                });

                // Handle power operator x^n
                expression = expression.replace(/([d.]+)s*\^s*([d.]+)/g, (match, base, exp) => {
                    return String(Math.pow(parseFloat(base), parseFloat(exp)));
                });

                // Simple arithmetic evaluation
                // Support: +, -, *, /, parentheses
                console.log("expression:", expression);
                const result = evalArithmetic(expression);
                return isNaN(result) || !isFinite(result) ? 0 : result;
            } catch (e) {
                console.error('Failed to evaluate expression:', expr, 'with variables:', variables, 'error:', e);
                return 0;
            }
        }

        function evalArithmetic(expr) {
            // Remove whitespace
            expr = expr.replace(/s+/g, '');

            // Evaluate parentheses first
            while (expr.includes('(')) {
                expr = expr.replace(/(([^()]+))/g, (match, inner) => {
                    return String(evalArithmetic(inner));
                });
            }

            // Evaluate multiplication and division
            while (/[d.]+[*/][d.]+/.test(expr)) {
                expr = expr.replace(/([d.]+)([*/])([d.]+)/, (match, a, op, b) => {
                    const numA = parseFloat(a);
                    const numB = parseFloat(b);
                    return String(op === '*' ? numA * numB : numA / numB);
                });
            }

            // Evaluate addition and subtraction
            while (/[d.]+[+-][d.]+/.test(expr)) {
                expr = expr.replace(/([d.]+)([+-])([d.]+)/, (match, a, op, b) => {
                    const numA = parseFloat(a);
                    const numB = parseFloat(b);
                    return String(op === '+' ? numA + numB : numA - numB);
                });
            }

            return parseFloat(expr);
        }

        function calculateStats() {
            const stats = [];

            // Calculate best scores for each seed
            const bests = {};
            for (const seed of seeds) {
                let maxScore = 0;
                for (const result of resultData) {
                    const testCase = result.cases.find(c => c.seed === seed);
                    if (testCase && testCase.score > maxScore) {
                        maxScore = testCase.score;
                    }
                }
                bests[seed] = maxScore;
            }

            for (const result of resultData) {
                const scores = [];
                let totalScore = 0;
                let bestCount = 0;
                let uniqueBestCount = 0;
                let failCount = 0;

                for (const seed of seeds) {
                    const testCase = result.cases.find(c => c.seed === seed);
                    if (testCase) {
                        if (testCase.score > 0) {
                            scores.push(testCase.score);
                            totalScore += testCase.score;

                            if (testCase.score === bests[seed] && bests[seed] > 0) {
                                bestCount++;
                                // Check if this is unique best
                                const othersWithSameScore = resultData.filter(r => {
                                    const tc = r.cases.find(c => c.seed === seed);
                                    return tc && tc.score === bests[seed];
                                }).length;
                                if (othersWithSameScore === 1) {
                                    uniqueBestCount++;
                                }
                            }
                        } else {
                            failCount++;
                        }
                    } else {
                        failCount++;
                    }
                }

                const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                const variance = scores.length > 0
                    ? scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
                    : 0;
                const sd = Math.sqrt(variance);

                stats.push({
                    name: result.time,
                    totalScore,
                    mean: Math.round(mean),
                    sd: Math.round(sd),
                    bestCount,
                    uniqueBestCount,
                    failCount
                });
            }

            return stats;
        }

        function updateStats() {
            const stats = calculateStats();
            const tbody = document.getElementById('statsTableBody');
            tbody.innerHTML = '';

            for (const stat of stats) {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>\${stat.name}</td>
                    <td>\${stat.totalScore.toLocaleString()}</td>
                    <td>\${stat.mean.toLocaleString()} ± \${stat.sd.toLocaleString()}</td>
                    <td>\${stat.bestCount}</td>
                    <td>\${stat.uniqueBestCount}</td>
                    <td>\${stat.failCount}</td>
                \`;
                tbody.appendChild(row);
            }
        }

        function createChart() {
            const ctx = document.getElementById('chart').getContext('2d');

            if (chart) {
                chart.destroy();
            }

            const chartDatasets = resultData.map((result, index) => {
                const color = datasets[index].borderColor;
                const filteredSeeds = seeds.filter(seed => {
                    if (!skipFailed) return true;
                    const testCase = result.cases.find(c => c.seed === seed);
                    return testCase && testCase.score > 0;
                });

                const data = filteredSeeds.map((seed, idx) => {
                    const testCase = result.cases.find(c => c.seed === seed);
                    if (!testCase) {
                        return null;
                    }

                    // Evaluate X axis expression
                    const variables = parseInputLine(seed);
                    const xValue = evaluateExpression(currentXAxis, variables);

                    return {
                        x: xValue,
                        y: currentYAxis === 'absolute' ? testCase.score : testCase.relativeScore,
                        resultId: result.id,
                        seed,
                        variables // for debugging
                    };
                }).filter(d => d !== null);

                // Sort by x value for line charts
                data.sort((a, b) => a.x - b.x);

                return {
                    label: result.time,
                    borderColor: color,
                    backgroundColor: color,
                    data,
                    showLine: currentChartType === 'line',
                    pointRadius: currentChartType === 'scatter' ? 4 : 3
                };
            });

            // Get computed CSS colors
            const foregroundColor = getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#cccccc';
            const gridColor = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border') || '#454545';

            const xAxisLabel = currentXAxis;
            const yAxisLabel = currentYAxis === 'absolute' ? 'スコア' : '相対スコア (%)';

            chart = new Chart(ctx, {
                type: currentChartType === 'scatter' ? 'scatter' : 'line',
                data: {
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
                                color: foregroundColor
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const point = context.raw;
                                    let label = context.dataset.label + ': ' + point.y.toLocaleString();
                                    label += '\\nseed: ' + point.seed;
                                    label += '\\nx: ' + point.x;
                                    if (point.variables) {
                                        label += '\\nvars: ' + JSON.stringify(point.variables);
                                    }
                                    return label.split('\\n');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            title: {
                                display: true,
                                text: xAxisLabel,
                                color: foregroundColor
                            },
                            ticks: {
                                color: foregroundColor
                            },
                            grid: {
                                color: gridColor
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: yAxisLabel,
                                color: foregroundColor
                            },
                            ticks: {
                                color: foregroundColor
                            },
                            grid: {
                                color: gridColor
                            }
                        }
                    }
                }
            });
        }

        // Event listeners
        document.getElementById('featuresInput').addEventListener('input', (e) => {
            const featuresValue = e.target.value;
            vscode.postMessage({
                command: 'saveFeatures',
                features: featuresValue
            });
            parseFeatures(featuresValue);
            updateStats();
            createChart();
        });

        document.getElementById('chartType').addEventListener('change', (e) => {
            currentChartType = e.target.value;
            createChart();
        });

        document.getElementById('xAxisInput').addEventListener('input', (e) => {
            currentXAxis = e.target.value;
            vscode.postMessage({
                command: 'saveXAxis',
                xAxis: currentXAxis
            });
            createChart();
        });

        document.getElementById('yAxisSelector').addEventListener('change', (e) => {
            currentYAxis = e.target.value;
            vscode.postMessage({
                command: 'saveYAxis',
                yAxis: currentYAxis
            });
            createChart();
        });

        document.getElementById('skipFailed').addEventListener('change', (e) => {
            skipFailed = e.target.checked;
            createChart();
        });
    </script>
</body>
</html>`;
	}
}
