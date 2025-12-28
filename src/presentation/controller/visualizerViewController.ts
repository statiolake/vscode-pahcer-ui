import * as vscode from 'vscode';
import type { IExecutionRepository } from '../../domain/interfaces/IExecutionRepository';
import type { IInOutFilesAdapter } from '../../domain/interfaces/IInOutFilesAdapter';
import type { IVisualizerCache } from '../../domain/interfaces/IVisualizerCache';
import type { IVisualizerDownloader } from '../../domain/interfaces/IVisualizerDownloader';

/**
 * ビジュアライザのWebViewコントローラ
 */
export class VisualizerViewController {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private readonly CONFIG_SECTION = 'pahcer-ui';

  constructor(
    _context: vscode.ExtensionContext,
    private inOutFilesAdapter: IInOutFilesAdapter,
    private executionRepository: IExecutionRepository,
    private visualizerDownloader: IVisualizerDownloader,
    private visualizerCache: IVisualizerCache,
  ) {}

  /**
   * ビジュアライザを表示
   */
  async showVisualizerForCase(seed: number, resultId?: string): Promise<void> {
    console.log(
      `[VisualizerViewController] Showing visualizer for seed: ${seed}, resultId: ${resultId}`,
    );

    // Check if visualizer is already downloaded
    let htmlFileName = this.visualizerCache.getCachedHtmlFileName();

    // Get visualizer URL if HTML file not found
    if (!htmlFileName) {
      console.log(
        `[VisualizerViewController] No cached visualizer found, requesting URL from user`,
      );

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
        console.log(`[VisualizerViewController] User cancelled URL input`);
        return;
      }

      console.log(`[VisualizerViewController] User provided URL: ${url}`);

      // Download visualizer files
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ビジュアライザをダウンロード中...',
          cancellable: false,
        },
        async () => {
          try {
            console.log(`[VisualizerViewController] Starting download`);
            htmlFileName = await this.visualizerDownloader.download(url);
            console.log(`[VisualizerViewController] Download completed: ${htmlFileName}`);
          } catch (e) {
            console.error(
              `[VisualizerViewController] Download failed:`,
              e instanceof Error ? e.message : String(e),
            );
            throw e;
          }
        },
      );
    } else {
      console.log(`[VisualizerViewController] Using cached visualizer: ${htmlFileName}`);
    }

    if (!htmlFileName) {
      console.error(`[VisualizerViewController] HTML file name is empty`);
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
      const result = await this.executionRepository.findById(resultId);
      if (result) {
        executionTime = ` (${result.startTime.toDate().toLocaleString()})`;
      } else {
        console.warn(`Execution ${resultId} not found`);
      }
    }

    // Read test case input and output from archived files
    // resultId should always be provided as execution results are archived immediately after running
    if (!resultId) {
      console.error('[VisualizerViewController] resultId is required but not provided');
      vscode.window.showErrorMessage('実行IDが指定されていません');
      return;
    }

    const input = await this.inOutFilesAdapter.loadIn(seed);
    const output = await this.inOutFilesAdapter.loadArchived('out', {
      executionId: resultId,
      seed,
    });

    // Get current zoom level from settings
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    const savedZoomLevel = config.get<number>('visualizerZoomLevel') || 1.0;

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
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(this.visualizerCache.getVisualizerDir())],
        },
      );

      VisualizerViewController.currentPanel = panel;

      // Listen for messages from the webview
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === 'saveZoomLevel') {
          const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
          await config.update(
            'visualizerZoomLevel',
            message.zoomLevel,
            vscode.ConfigurationTarget.Global,
          );
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
    console.log(`[VisualizerViewController] Converting resource paths in HTML`);

    // Convert relative paths to webview URIs
    html = html.replace(/src=["']\.\/([^"']+)["']/g, (match, fileName) => {
      if (this.visualizerCache.resourceExists(fileName)) {
        const resourceUri = webview.asWebviewUri(
          vscode.Uri.file(this.visualizerCache.getResourcePath(fileName)),
        );
        console.log(
          `[VisualizerViewController] Converted relative path: ./${fileName} -> ${resourceUri}`,
        );
        return `src="${resourceUri}"`;
      } else {
        console.warn(`[VisualizerViewController] Resource not found: ${fileName}`);
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
          console.log(
            `[VisualizerViewController] Converted protocol-relative URL: ${fileName} -> ${resourceUri}`,
          );
          return `src="${resourceUri}"`;
        } else {
          console.warn(`[VisualizerViewController] Resource not found: ${fileName}`);
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
        console.log(
          `[VisualizerViewController] Converted module import: ./${fileName} -> ${resourceUri}`,
        );
        return `from "${resourceUri}"`;
      } else {
        console.warn(`[VisualizerViewController] Module not found: ${fileName}`);
      }
      return match;
    });

    console.log(`[VisualizerViewController] Resource path conversion completed`);
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

                    if (inputTextarea) {
                        inputTextarea.value = input || '';
                    }

                    if (outputTextarea) {
                        outputTextarea.value = output || '';
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
