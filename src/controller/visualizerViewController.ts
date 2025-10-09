import * as vscode from 'vscode';
import { ConfigAdapter } from '../infrastructure/configAdapter';
import { InputFileRepository } from '../infrastructure/inputFileRepository';
import { OutputFileRepository } from '../infrastructure/outputFileRepository';
import { PahcerResultRepository } from '../infrastructure/pahcerResultRepository';
import { VisualizerCache } from '../infrastructure/visualizerCache';
import { VisualizerDownloader } from '../infrastructure/visualizerDownloader';

/**
 * ビジュアライザのWebViewコントローラ
 */
export class VisualizerViewController {
	private static currentPanel: vscode.WebviewPanel | undefined;

	private inputFileRepository: InputFileRepository;
	private outputFileRepository: OutputFileRepository;
	private resultRepository: PahcerResultRepository;
	private visualizerDownloader: VisualizerDownloader;
	private visualizerCache: VisualizerCache;
	private configAdapter: ConfigAdapter;

	constructor(_context: vscode.ExtensionContext, workspaceRoot: string) {
		const visualizerDir = `${workspaceRoot}/.pahcer-ui/visualizer`;

		this.inputFileRepository = new InputFileRepository(workspaceRoot);
		this.outputFileRepository = new OutputFileRepository(workspaceRoot);
		this.resultRepository = new PahcerResultRepository(workspaceRoot);
		this.visualizerDownloader = new VisualizerDownloader(visualizerDir);
		this.visualizerCache = new VisualizerCache(visualizerDir);
		this.configAdapter = new ConfigAdapter();
	}

	/**
	 * ビジュアライザを表示
	 */
	async showVisualizerForCase(seed: number, resultId?: string): Promise<void> {
		// Check if visualizer is already downloaded
		let htmlFileName = this.visualizerCache.getCachedHtmlFileName();

		// Get visualizer URL if HTML file not found
		if (!htmlFileName) {
			const url = await vscode.window.showInputBox({
				prompt: 'AtCoder公式ビジュアライザのURLを入力してください',
				placeHolder: 'https://img.atcoder.jp/ahc054/YDAxDRZr_v2.html?lang=ja',
				validateInput: (value) => {
					if (!value) {
						return 'URLを入力してください';
					}
					if (!value.startsWith('https://img.atcoder.jp/')) {
						return 'AtCoderの公式URLを入力してください';
					}
					const urlWithoutQuery = value.split('?')[0];
					if (!urlWithoutQuery.endsWith('.html')) {
						return 'HTMLファイルのURLを入力してください';
					}
					return null;
				},
			});

			if (!url) {
				return;
			}

			// Download visualizer files
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'ビジュアライザをダウンロード中...',
					cancellable: false,
				},
				async () => {
					htmlFileName = await this.visualizerDownloader.download(url);
				},
			);
		}

		if (!htmlFileName) {
			vscode.window.showErrorMessage('ビジュアライザファイルが見つかりません');
			return;
		}

		// Open visualizer with test case data
		await this.openVisualizer(seed, resultId, htmlFileName);
	}

	/**
	 * ビジュアライザを開く
	 */
	private async openVisualizer(
		seed: number,
		resultId: string | undefined,
		htmlFileName: string,
	): Promise<void> {
		// Get execution time from result file if resultId is provided
		let executionTime = '';
		if (resultId) {
			const result = await this.resultRepository.loadResult(resultId);
			if (result) {
				executionTime = ` (${new Date(result.startTime).toLocaleString()})`;
			}
		}

		// Read test case input and output
		const input = (await this.inputFileRepository.load(seed)) || '';
		const output = (await this.outputFileRepository.load(seed, resultId)) || '';

		// Get current zoom level from settings
		const savedZoomLevel = this.configAdapter.getVisualizerZoomLevel();

		// Reuse existing panel if available, otherwise create new one
		if (VisualizerViewController.currentPanel) {
			// Update title
			VisualizerViewController.currentPanel.title = `Seed ${seed}${executionTime}`;

			// Reveal panel if hidden
			VisualizerViewController.currentPanel.reveal(vscode.ViewColumn.Active);

			// Update only input/output without reloading WebView
			VisualizerViewController.currentPanel.webview.postMessage({
				type: 'updateTestCase',
				seed,
				input,
				output,
			});
		} else {
			// Create a new webview panel
			const panel = vscode.window.createWebviewPanel(
				'pahcerVisualizer',
				`Seed ${seed}${executionTime}`,
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(this.visualizerCache.getVisualizerDir())],
				},
			);

			VisualizerViewController.currentPanel = panel;

			// Listen for messages from the webview
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.type === 'saveZoomLevel') {
					await this.configAdapter.setVisualizerZoomLevel(message.zoomLevel);
				}
			});

			// Reset currentPanel when the panel is disposed
			panel.onDidDispose(() => {
				VisualizerViewController.currentPanel = undefined;
			});

			// Read HTML content
			let htmlContent = this.visualizerCache.readHtml(htmlFileName);

			// Convert local paths to webview URIs
			htmlContent = this.convertResourcePaths(htmlContent, panel.webview);

			// Inject input/output data and message listener
			htmlContent = this.injectTestCaseData(htmlContent, seed, input, output, savedZoomLevel);

			panel.webview.html = htmlContent;
		}
	}

	/**
	 * リソースパスをWebView URIに変換
	 */
	private convertResourcePaths(html: string, webview: vscode.Webview): string {
		// Convert relative paths to webview URIs
		html = html.replace(/src=["']\.\/([^"']+)["']/g, (match, fileName) => {
			if (this.visualizerCache.resourceExists(fileName)) {
				const resourceUri = webview.asWebviewUri(
					vscode.Uri.file(this.visualizerCache.getResourcePath(fileName)),
				);
				return `src="${resourceUri}"`;
			}
			return match;
		});

		// Also handle protocol-relative URLs that we downloaded
		html = html.replace(
			/src=["']\/\/img\.atcoder\.jp\/[^"']*\/([^"'/]+)["']/g,
			(match, fileName) => {
				if (this.visualizerCache.resourceExists(fileName)) {
					const resourceUri = webview.asWebviewUri(
						vscode.Uri.file(this.visualizerCache.getResourcePath(fileName)),
					);
					return `src="${resourceUri}"`;
				}
				return match;
			},
		);

		// Handle imports from ES modules
		html = html.replace(/from\s+["']\.\/([^"']+\.js)["']/g, (match, fileName) => {
			if (this.visualizerCache.resourceExists(fileName)) {
				const resourceUri = webview.asWebviewUri(
					vscode.Uri.file(this.visualizerCache.getResourcePath(fileName)),
				);
				return `from "${resourceUri}"`;
			}
			return match;
		});

		return html;
	}

	/**
	 * テストケースデータを注入
	 */
	private injectTestCaseData(
		html: string,
		seed: number,
		input: string,
		output: string,
		initialZoomLevel: number,
	): string {
		const injection = `
            <script>
                window.PAHCER_SEED = ${seed};
                window.PAHCER_INPUT = ${JSON.stringify(input)};
                window.PAHCER_OUTPUT = ${JSON.stringify(output)};

                const vscode = acquireVsCodeApi();

                function updateTestCaseData(seed, input, output) {
                    window.PAHCER_SEED = seed;
                    window.PAHCER_INPUT = input;
                    window.PAHCER_OUTPUT = output;

                    const seedInput = document.getElementById('seed');
                    const inputTextarea = document.getElementById('input');
                    const outputTextarea = document.getElementById('output');

                    if (seedInput && seed !== undefined) {
                        seedInput.value = seed;
                    }

                    if (inputTextarea && input) {
                        inputTextarea.value = input;
                    }

                    if (outputTextarea && output) {
                        outputTextarea.value = output;
                    }

                    if (typeof updateOutput === 'function') {
                        updateOutput();
                    }
                }

                window.addEventListener('message', (event) => {
                    const message = event.data;
                    if (message.type === 'updateTestCase') {
                        updateTestCaseData(message.seed, message.input, message.output);
                    }
                });

                window.addEventListener('DOMContentLoaded', () => {
                    updateTestCaseData(window.PAHCER_SEED, window.PAHCER_INPUT, window.PAHCER_OUTPUT);
                    createZoomUI();
                    if (zoomLevel !== 1.0) {
                        applyZoom();
                    }
                });

                let zoomLevel = ${initialZoomLevel};
                const MIN_ZOOM = 0.5;
                const MAX_ZOOM = 3.0;
                const ZOOM_STEP = 0.1;

                function applyZoom() {
                    let contentWrapper = document.getElementById('pahcer-content-wrapper');
                    if (!contentWrapper) {
                        contentWrapper = document.createElement('div');
                        contentWrapper.id = 'pahcer-content-wrapper';
                        contentWrapper.style.transformOrigin = 'top left';

                        const zoomUI = document.getElementById('pahcer-zoom-controls');
                        while (document.body.firstChild) {
                            if (document.body.firstChild !== zoomUI) {
                                contentWrapper.appendChild(document.body.firstChild);
                            } else {
                                break;
                            }
                        }
                        document.body.insertBefore(contentWrapper, document.body.firstChild);
                    }

                    contentWrapper.style.transform = \`scale(\${zoomLevel})\`;
                    contentWrapper.style.width = \`\${100 / zoomLevel}%\`;
                    contentWrapper.style.height = \`\${100 / zoomLevel}%\`;
                    updateZoomDisplay();

                    vscode.postMessage({
                        type: 'saveZoomLevel',
                        zoomLevel: zoomLevel
                    });
                }

                function updateZoomDisplay() {
                    const display = document.getElementById('pahcer-zoom-display');
                    if (display) {
                        display.textContent = \`\${Math.round(zoomLevel * 100)}%\`;
                    }
                }

                function createZoomUI() {
                    const container = document.createElement('div');
                    container.id = 'pahcer-zoom-controls';
                    container.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(0,0,0,0.7); padding: 6px; border-radius: 4px; display: flex; gap: 4px; align-items: center; font-family: sans-serif; color: white; box-sizing: border-box;';

                    const buttonStyle = 'background: #444; color: white; border: none; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-size: 14px; box-sizing: border-box; height: 24px; line-height: 14px; display: inline-flex; align-items: center; justify-content: center;';

                    const zoomOut = document.createElement('button');
                    zoomOut.textContent = '−';
                    zoomOut.style.cssText = buttonStyle;
                    zoomOut.onclick = () => {
                        zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
                        applyZoom();
                    };

                    const display = document.createElement('span');
                    display.id = 'pahcer-zoom-display';
                    display.style.cssText = 'min-width: 45px; text-align: center; font-size: 12px; box-sizing: border-box;';
                    display.textContent = '100%';

                    const zoomIn = document.createElement('button');
                    zoomIn.textContent = '+';
                    zoomIn.style.cssText = buttonStyle;
                    zoomIn.onclick = () => {
                        zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
                        applyZoom();
                    };

                    const reset = document.createElement('button');
                    reset.textContent = '100%';
                    reset.style.cssText = buttonStyle;
                    reset.onclick = () => {
                        zoomLevel = 1.0;
                        applyZoom();
                    };

                    container.appendChild(zoomOut);
                    container.appendChild(display);
                    container.appendChild(zoomIn);
                    container.appendChild(reset);

                    document.body.appendChild(container);
                }

                window.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
                        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
                        applyZoom();
                    }
                }, { passive: false });

                window.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                        if (e.key === '=' || e.key === '+') {
                            e.preventDefault();
                            zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
                            applyZoom();
                        } else if (e.key === '-') {
                            e.preventDefault();
                            zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
                            applyZoom();
                        } else if (e.key === '0') {
                            e.preventDefault();
                            zoomLevel = 1.0;
                            applyZoom();
                        }
                    }
                });
            </script>
        `;

		if (html.includes('</head>')) {
			html = html.replace('</head>', `${injection}</head>`);
		} else if (html.includes('<body>')) {
			html = html.replace('<body>', `<body>${injection}`);
		} else {
			html = injection + html;
		}

		return html;
	}

	/**
	 * リセット（テスト用）
	 */
	static reset(): void {
		VisualizerViewController.currentPanel = undefined;
	}
}
