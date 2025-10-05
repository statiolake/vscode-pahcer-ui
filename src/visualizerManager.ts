import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import * as vscode from 'vscode';

export class VisualizerManager {
	private static visualizerDir: string | undefined;
	private static htmlFileName: string | undefined;
	private static currentPanel: vscode.WebviewPanel | undefined;

	constructor(
		private context: vscode.ExtensionContext,
		private workspaceRoot: string,
	) {
		VisualizerManager.visualizerDir = path.join(workspaceRoot, '.pahcer-ui', 'visualizer');
	}

	async showVisualizerForCase(
		seed: number,
		inputPath: string,
		outputPath: string,
		resultId?: string,
	) {
		// Check if visualizer is already downloaded
		if (!VisualizerManager.htmlFileName && VisualizerManager.visualizerDir) {
			// Check if visualizer directory exists and has HTML file
			if (fs.existsSync(VisualizerManager.visualizerDir)) {
				const files = fs.readdirSync(VisualizerManager.visualizerDir);
				const htmlFile = files.find((f) => f.endsWith('.html'));
				if (htmlFile) {
					VisualizerManager.htmlFileName = htmlFile;
				}
			}
		}

		// Get visualizer URL if HTML file not found
		if (!VisualizerManager.htmlFileName) {
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
					// Remove query params for validation
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
			const urlObj = new URL(url);
			VisualizerManager.htmlFileName = path.basename(urlObj.pathname);
			const htmlPath = VisualizerManager.visualizerDir
				? path.join(VisualizerManager.visualizerDir, VisualizerManager.htmlFileName)
				: '';

			if (!htmlPath || !fs.existsSync(htmlPath)) {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'ビジュアライザをダウンロード中...',
						cancellable: false,
					},
					async (progress) => {
						await this.downloadVisualizer(url);
					},
				);
			}
		}

		// Open visualizer with test case data
		await this.openVisualizer(seed, inputPath, outputPath, resultId);
	}

	private async downloadVisualizer(url: string) {
		if (!VisualizerManager.visualizerDir) {
			throw new Error('Visualizer directory not set');
		}

		// Create directory
		if (!fs.existsSync(VisualizerManager.visualizerDir)) {
			fs.mkdirSync(VisualizerManager.visualizerDir, { recursive: true });
		}

		// Remove query parameters for file operations
		const urlObj = new URL(url);
		const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

		// Download main HTML
		const htmlContent = await this.fetchUrl(cleanUrl);
		const htmlFileName = path.basename(urlObj.pathname);
		const htmlPath = path.join(VisualizerManager.visualizerDir, htmlFileName);
		fs.writeFileSync(htmlPath, htmlContent);

		// Parse and download dependencies
		await this.downloadDependencies(htmlContent, cleanUrl);
	}

	private async downloadDependencies(htmlContent: string, baseUrl: string) {
		if (!VisualizerManager.visualizerDir) {
			return;
		}

		const baseUrlObj = new URL(baseUrl);
		const baseDir = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/'));

		// Find script and link tags
		const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
		const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;
		const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
		// Also look for ES module imports
		const importRegex = /from\s+["']([^"']+\.js)["']/g;

		const dependencies = new Set<string>();

		let match: RegExpExecArray | null;
		match = scriptRegex.exec(htmlContent);
		while (match !== null) {
			dependencies.add(match[1]);
			match = scriptRegex.exec(htmlContent);
		}
		match = linkRegex.exec(htmlContent);
		while (match !== null) {
			dependencies.add(match[1]);
			match = linkRegex.exec(htmlContent);
		}
		match = imgRegex.exec(htmlContent);
		while (match !== null) {
			dependencies.add(match[1]);
			match = imgRegex.exec(htmlContent);
		}
		match = importRegex.exec(htmlContent);
		while (match !== null) {
			dependencies.add(match[1]);
			match = importRegex.exec(htmlContent);
		}

		// Download each dependency
		for (const dep of dependencies) {
			try {
				// Skip protocol-relative and absolute external URLs
				if (dep.startsWith('//') || dep.startsWith('http://') || dep.startsWith('https://')) {
					// Handle protocol-relative URLs (//img.atcoder.jp/...)
					if (dep.startsWith('//img.atcoder.jp/')) {
						const fullUrl = `https:${dep}`;
						const fileName = path.basename(new URL(fullUrl).pathname);
						const depPath = path.join(VisualizerManager.visualizerDir, fileName);

						if (!fs.existsSync(depPath)) {
							console.log(`Downloading ${fullUrl}`);
							const depContent = await this.fetchUrl(fullUrl);
							fs.writeFileSync(depPath, depContent);
						}
					}
					continue;
				}

				// Handle relative paths
				const depUrl = dep.startsWith('./')
					? `${baseUrlObj.origin}${baseDir}/${dep.substring(2)}`
					: `${baseUrlObj.origin}${baseDir}/${dep}`;

				console.log(`Downloading ${depUrl}`);
				const depContent = await this.fetchUrl(depUrl);

				const depPath = path.join(VisualizerManager.visualizerDir, path.basename(dep));
				fs.writeFileSync(depPath, depContent);

				// If it's a .js file, also try to download the .wasm file
				if (dep.endsWith('.js')) {
					const wasmFile = dep.replace('.js', '_bg.wasm');
					const wasmUrl = wasmFile.startsWith('./')
						? `${baseUrlObj.origin}${baseDir}/${wasmFile.substring(2)}`
						: `${baseUrlObj.origin}${baseDir}/${wasmFile}`;

					try {
						console.log(`Trying to download ${wasmUrl}`);
						const wasmContent = await this.fetchUrlBinary(wasmUrl);
						const wasmPath = path.join(VisualizerManager.visualizerDir, path.basename(wasmFile));
						fs.writeFileSync(wasmPath, wasmContent);
					} catch (e) {
						// WASM file might not exist, that's ok
						console.log(`WASM file not found: ${wasmUrl}`);
					}
				}
			} catch (e) {
				console.error(`Failed to download dependency ${dep}:`, e);
			}
		}
	}

	private fetchUrl(url: string): Promise<string> {
		return new Promise((resolve, reject) => {
			https
				.get(url, (res) => {
					if (res.statusCode === 301 || res.statusCode === 302) {
						if (res.headers.location) {
							return this.fetchUrl(res.headers.location).then(resolve).catch(reject);
						}
					}

					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => resolve(data));
				})
				.on('error', reject);
		});
	}

	private fetchUrlBinary(url: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			https
				.get(url, (res) => {
					if (res.statusCode === 301 || res.statusCode === 302) {
						if (res.headers.location) {
							return this.fetchUrlBinary(res.headers.location).then(resolve).catch(reject);
						}
					}

					const chunks: Buffer[] = [];
					res.on('data', (chunk) => chunks.push(chunk));
					res.on('end', () => resolve(Buffer.concat(chunks)));
				})
				.on('error', reject);
		});
	}

	private async openVisualizer(
		seed: number,
		inputPath: string,
		outputPath: string,
		resultId?: string,
	) {
		if (!VisualizerManager.htmlFileName || !VisualizerManager.visualizerDir) {
			return;
		}

		const htmlPath = path.join(VisualizerManager.visualizerDir, VisualizerManager.htmlFileName);

		if (!fs.existsSync(htmlPath)) {
			vscode.window.showErrorMessage('ビジュアライザファイルが見つかりません');
			return;
		}

		// Get execution time from result file if resultId is provided
		let executionTime = '';
		if (resultId) {
			const jsonPath = path.join(this.workspaceRoot, 'pahcer', 'json', `result_${resultId}.json`);
			if (fs.existsSync(jsonPath)) {
				try {
					const content = fs.readFileSync(jsonPath, 'utf-8');
					const result = JSON.parse(content);
					executionTime = ` (${new Date(result.start_time).toLocaleString()})`;
				} catch (e) {
					// Ignore error
				}
			}
		}

		// Read test case input and output
		const input = fs.existsSync(inputPath) ? fs.readFileSync(inputPath, 'utf-8') : '';
		const output = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';

		// Get current zoom level from settings
		const config = vscode.workspace.getConfiguration('pahcer-ui');
		const savedZoomLevel = config.get<number>('visualizerZoomLevel', 1.0);

		// Reuse existing panel if available, otherwise create new one
		if (VisualizerManager.currentPanel) {
			// Update title
			VisualizerManager.currentPanel.title = `Seed ${seed}${executionTime}`;

			// Reveal panel if hidden
			VisualizerManager.currentPanel.reveal(vscode.ViewColumn.Active);

			// Update only input/output without reloading WebView
			// This preserves scroll position and zoom level
			VisualizerManager.currentPanel.webview.postMessage({
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
					localResourceRoots: [vscode.Uri.file(VisualizerManager.visualizerDir)],
				},
			);

			VisualizerManager.currentPanel = panel;

			// Listen for messages from the webview
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.type === 'saveZoomLevel') {
					const config = vscode.workspace.getConfiguration('pahcer-ui');
					await config.update(
						'visualizerZoomLevel',
						message.zoomLevel,
						vscode.ConfigurationTarget.Global,
					);
				}
			});

			// Reset currentPanel when the panel is disposed
			panel.onDidDispose(() => {
				VisualizerManager.currentPanel = undefined;
			});

			// Read HTML content
			let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

			// Convert local paths to webview URIs
			htmlContent = this.convertResourcePaths(htmlContent, panel.webview);

			// Inject input/output data and message listener
			htmlContent = this.injectTestCaseData(htmlContent, seed, input, output, savedZoomLevel);

			panel.webview.html = htmlContent;
		}
	}

	private convertResourcePaths(html: string, webview: vscode.Webview): string {
		if (!VisualizerManager.visualizerDir) {
			return html;
		}

		// Convert relative paths to webview URIs
		html = html.replace(/src=["']\.\/([^"']+)["']/g, (match, fileName) => {
			if (!VisualizerManager.visualizerDir) {
				return match;
			}
			const resourcePath = path.join(VisualizerManager.visualizerDir, fileName);
			if (fs.existsSync(resourcePath)) {
				const resourceUri = webview.asWebviewUri(vscode.Uri.file(resourcePath));
				return `src="${resourceUri}"`;
			}
			return match;
		});

		// Also handle protocol-relative URLs that we downloaded
		html = html.replace(
			/src=["']\/\/img\.atcoder\.jp\/[^"']*\/([^"'/]+)["']/g,
			(match, fileName) => {
				if (!VisualizerManager.visualizerDir) {
					return match;
				}
				const resourcePath = path.join(VisualizerManager.visualizerDir, fileName);
				if (fs.existsSync(resourcePath)) {
					const resourceUri = webview.asWebviewUri(vscode.Uri.file(resourcePath));
					return `src="${resourceUri}"`;
				}
				return match;
			},
		);

		// Handle imports from ES modules
		html = html.replace(/from\s+["']\.\/([^"']+\.js)["']/g, (match, fileName) => {
			if (!VisualizerManager.visualizerDir) {
				return match;
			}
			const resourcePath = path.join(VisualizerManager.visualizerDir, fileName);
			if (fs.existsSync(resourcePath)) {
				const resourceUri = webview.asWebviewUri(vscode.Uri.file(resourcePath));
				return `from "${resourceUri}"`;
			}
			return match;
		});

		return html;
	}

	private injectTestCaseData(
		html: string,
		seed: number,
		input: string,
		output: string,
		initialZoomLevel: number,
	): string {
		// Inject seed, input, and output as global variables
		const injection = `
            <script>
                window.PAHCER_SEED = ${seed};
                window.PAHCER_INPUT = ${JSON.stringify(input)};
                window.PAHCER_OUTPUT = ${JSON.stringify(output)};

                // Acquire VS Code API for messaging
                const vscode = acquireVsCodeApi();

                // Function to update test case data
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

                    // Trigger update to visualize
                    if (typeof updateOutput === 'function') {
                        updateOutput();
                    }
                }

                // Listen for messages from extension
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    if (message.type === 'updateTestCase') {
                        updateTestCaseData(message.seed, message.input, message.output);
                    }
                });

                // Auto-fill input and output when page loads
                window.addEventListener('DOMContentLoaded', () => {
                    updateTestCaseData(window.PAHCER_SEED, window.PAHCER_INPUT, window.PAHCER_OUTPUT);
                    createZoomUI();
                    // Apply initial zoom level
                    if (zoomLevel !== 1.0) {
                        applyZoom();
                    }
                });

                // Zoom functionality
                let zoomLevel = ${initialZoomLevel};
                const MIN_ZOOM = 0.5;
                const MAX_ZOOM = 3.0;
                const ZOOM_STEP = 0.1;

                function applyZoom() {
                    let contentWrapper = document.getElementById('pahcer-content-wrapper');
                    if (!contentWrapper) {
                        // Create wrapper on first zoom
                        contentWrapper = document.createElement('div');
                        contentWrapper.id = 'pahcer-content-wrapper';
                        contentWrapper.style.transformOrigin = 'top left';

                        // Move all existing body children (except zoom UI) into wrapper
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

                    // Save zoom level to settings
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

                function updateZoomUITransform() {
                    // No longer needed - zoom UI is now outside the zoomed content
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

                    // Insert at the end of body (after content wrapper)
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

                // Keyboard shortcuts for zoom
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

		// Insert before closing head tag or at the beginning of body
		if (html.includes('</head>')) {
			html = html.replace('</head>', `${injection}</head>`);
		} else if (html.includes('<body>')) {
			html = html.replace('<body>', `<body>${injection}`);
		} else {
			html = injection + html;
		}

		return html;
	}

	static reset() {
		VisualizerManager.htmlFileName = undefined;
		VisualizerManager.currentPanel = undefined;
	}
}
