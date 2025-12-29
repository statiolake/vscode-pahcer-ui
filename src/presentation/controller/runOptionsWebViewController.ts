import * as vscode from 'vscode';
import type { RunPahcerUseCase } from '../../application/runPahcerUseCase';
import type { VSCodeUIContext } from '../vscodeUIContext';

interface RunOptions {
  startSeed: number;
  endSeed: number;
  freezeBestScores: boolean;
}

/**
 * Git統合を有効にするか確認するダイアログを表示
 */
async function confirmGitIntegration(): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    'Pahcer UIでGit統合を有効にしますか？',
    {
      modal: true,
      detail:
        '有効にすると、テスト実行前に自動的にコミットを作成し、後でバージョン間の差分を確認できます。\n\n' +
        '⚠️ 注意: ワークスペース内のすべての変更ファイルが自動的にコミットされます。' +
        '.gitignoreを注意深く確認し、コミットしたくないファイルが除外されていることを確認してください。',
    },
    { title: '有効にする' },
    { title: '無効にする', isCloseAffordance: true },
  );

  return result !== undefined && result.title === '有効にする';
}

export class RunOptionsWebViewController implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly vscodeUIContext: VSCodeUIContext,
    private readonly runPahcerUseCase: RunPahcerUseCase,
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
      await this.vscodeUIContext.setShowRunOptions(false);

      // Execute pahcer run with options
      const result = await this.runPahcerUseCase.handle({
        options: {
          startSeed: options.startSeed,
          endSeed: options.endSeed,
          freezeBestScores: options.freezeBestScores,
        },
        confirmGitIntegration,
      });

      // ユースケースからのメッセージを表示
      for (const message of result.messages) {
        vscode.window.showInformationMessage(message);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
    }
  }

  async cancel(): Promise<void> {
    // Switch back to TreeView
    await this.vscodeUIContext.setShowRunOptions(false);
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
