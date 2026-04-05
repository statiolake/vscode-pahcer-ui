import * as vscode from 'vscode';
import type { PrepareComparisonUseCase } from '../../application/prepareComparisonUseCase';
import type { IUIConfigRepository } from '../../domain/interfaces/IUIConfigRepository';

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

  constructor(
    private context: vscode.ExtensionContext,
    private prepareComparisonUseCase: PrepareComparisonUseCase,
    private uiConfigRepository: IUIConfigRepository,
  ) {}

  /**
   * 比較ビューを表示
   */
  async showComparison(executionIds: string[]): Promise<void> {
    const comparisonData = await this.prepareComparisonUseCase.execute(executionIds);
    if (!comparisonData) {
      // Close panel if no results selected
      if (this.panel) {
        this.panel.dispose();
      }
      return;
    }

    try {
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
              await this.uiConfigRepository.upsert(message.config);
            }
          },
          undefined,
          this.context.subscriptions,
        );

        // Set initial HTML
        this.panel.webview.html = this.getWebviewContent(comparisonData, this.panel.webview);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `比較データの準備に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * WebViewのHTMLを生成
   */
  private getWebviewContent(
    comparisonData: NonNullable<Awaited<ReturnType<PrepareComparisonUseCase['execute']>>>,
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
