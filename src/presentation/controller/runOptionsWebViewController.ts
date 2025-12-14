import * as vscode from 'vscode';
import type { RunPahcerUseCase } from '../../application/runPahcerUseCase';
import type { IKeybindingContextAdapter } from '../../domain/interfaces/IKeybindingContextAdapter';

interface RunOptions {
  startSeed: number;
  endSeed: number;
  freezeBestScores: boolean;
}

export class RunOptionsWebViewController implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly runPahcerUseCase: RunPahcerUseCase,
    private readonly keybindingContextAdapter: IKeybindingContextAdapter,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'runWithOptions':
          await this.runWithOptions(message.options);
          // Refresh tree view after run completes
          await vscode.commands.executeCommand('pahcer-ui.refresh');
          break;
        case 'cancelRunOptions':
          await this.cancel();
          break;
      }
    });
  }

  private async runWithOptions(options: RunOptions): Promise<void> {
    try {
      // Switch back to TreeView
      await this.keybindingContextAdapter.setShowRunOptions(false);

      // Execute pahcer run with options
      await this.runPahcerUseCase.run({
        startSeed: options.startSeed,
        endSeed: options.endSeed,
        freezeBestScores: options.freezeBestScores,
      });
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
    }
  }

  async cancel(): Promise<void> {
    // Switch back to TreeView
    await this.keybindingContextAdapter.setShowRunOptions(false);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'runOptions.js'),
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
	<title>Pahcer Run Options</title>
</head>
<body>
	<div id="root"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
