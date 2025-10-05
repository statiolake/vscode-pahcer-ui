import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import * as vscode from 'vscode';

export class VisualizerManager {
	private static visualizerDir: string | undefined;
	private static htmlFileName: string | undefined;

	constructor(
		private context: vscode.ExtensionContext,
		private workspaceRoot: string,
	) {
		VisualizerManager.visualizerDir = path.join(workspaceRoot, '.vscode-pahcer-ui');
	}

	async showVisualizerForCase(seed: number, inputPath: string, outputPath: string) {
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
		await this.openVisualizer(seed, inputPath, outputPath);
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

	private async openVisualizer(seed: number, inputPath: string, outputPath: string) {
		if (!VisualizerManager.htmlFileName || !VisualizerManager.visualizerDir) {
			return;
		}

		const htmlPath = path.join(VisualizerManager.visualizerDir, VisualizerManager.htmlFileName);

		if (!fs.existsSync(htmlPath)) {
			vscode.window.showErrorMessage('ビジュアライザファイルが見つかりません');
			return;
		}

		// Create a new webview panel for each case
		const panel = vscode.window.createWebviewPanel(
			'pahcerVisualizer',
			`Visualizer - Seed ${seed}`,
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(VisualizerManager.visualizerDir)],
			},
		);

		// Read HTML content
		let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		// Read test case input and output
		const input = fs.existsSync(inputPath) ? fs.readFileSync(inputPath, 'utf-8') : '';
		const output = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';

		// Convert local paths to webview URIs
		htmlContent = this.convertResourcePaths(htmlContent, panel.webview);

		// Inject input/output data
		htmlContent = this.injectTestCaseData(htmlContent, seed, input, output);

		panel.webview.html = htmlContent;
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

	private injectTestCaseData(html: string, seed: number, input: string, output: string): string {
		// Inject seed, input, and output as global variables
		const injection = `
            <script>
                window.PAHCER_SEED = ${seed};
                window.PAHCER_INPUT = ${JSON.stringify(input)};
                window.PAHCER_OUTPUT = ${JSON.stringify(output)};

                // Auto-fill input and output when page loads
                window.addEventListener('DOMContentLoaded', () => {
                    const seedInput = document.getElementById('seed');
                    const inputTextarea = document.getElementById('input');
                    const outputTextarea = document.getElementById('output');

                    if (seedInput && window.PAHCER_SEED !== undefined) {
                        seedInput.value = window.PAHCER_SEED;
                    }

                    if (inputTextarea && window.PAHCER_INPUT) {
                        inputTextarea.value = window.PAHCER_INPUT;
                    }

                    if (outputTextarea && window.PAHCER_OUTPUT) {
                        outputTextarea.value = window.PAHCER_OUTPUT;
                    }

                    // Trigger update to visualize
                    if (typeof updateOutput === 'function') {
                        updateOutput();
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
	}
}
