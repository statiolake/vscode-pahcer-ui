import * as vscode from 'vscode';
import { DownloadTesterError, type InitializeUseCase } from '../../application/initializeUseCase';
import type { VSCodeUIContext } from '../vscodeUIContext';

interface InitOptions {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
  testerUrl: string;
}

/**
 * pahcer init を実行するための初期化WebView
 */
export class InitializationWebViewController implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly vscodeUIContext: VSCodeUIContext,
    private readonly initializeUseCase: InitializeUseCase,
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = await this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'initialize':
          await this.handleInitialize(message.options);
          break;
      }
    });
  }

  private async handleInitialize(options: InitOptions): Promise<void> {
    try {
      if (options.testerUrl) {
        vscode.window.showInformationMessage('ローカルテスターをダウンロード中...');
      }

      await this.initializeUseCase.handle({
        problemName: options.problemName,
        objective: options.objective,
        language: options.language,
        isInteractive: options.isInteractive,
        testerUrl: options.testerUrl,
        confirmToUseDetected: async (userSelectedInteractive, testerSeemsInteractive) => {
          const detectedType = testerSeemsInteractive
            ? 'インタラクティブ問題'
            : '非インタラクティブ問題';
          const userSelectedType = userSelectedInteractive
            ? 'インタラクティブ'
            : '非インタラクティブ';

          const answer = await vscode.window.showWarningMessage(
            '検出されたインタラクティブ設定に変更しますか？',
            {
              modal: true,
              detail:
                `ダウンロードされたローカルテスターの構成から、指定と異なる問題タイプが検出されました。\n\n` +
                `指定された問題タイプ: ${userSelectedType}\n` +
                `検出された問題タイプ: ${detectedType}\n\n` +
                `検出された問題タイプで続けますか？`,
            },
            {
              title: testerSeemsInteractive ? 'インタラクティブに変更' : '非インタラクティブに変更',
            },
            { title: 'このまま続行', isCloseAffordance: true },
          );

          // 「〜に変更」の選択肢を選んだ場合は true を返す
          return answer !== undefined && answer.title !== 'このまま続行';
        },
      });

      await this.vscodeUIContext.setShowInitialization(false);

      if (options.testerUrl) {
        void vscode.window.showInformationMessage('ローカルテスターのダウンロードが完了しました。');
      }

      await vscode.commands.executeCommand('pahcer-ui.refresh');
    } catch (error) {
      if (error instanceof DownloadTesterError) {
        vscode.window.showErrorMessage(
          `ローカルテスターのダウンロードに失敗しました: ${error.message}`,
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`初期化に失敗しました: ${errorMessage}`);
      }
    }
  }

  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'initialization.js'),
    );

    const defaultProjectName = await this.initializeUseCase.getDefaultProjectName();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
	<title>Pahcer 初期化</title>
</head>
<body>
	<div id="root" data-default-project-name="${defaultProjectName}"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
