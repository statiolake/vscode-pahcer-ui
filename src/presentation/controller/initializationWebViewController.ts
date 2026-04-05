import * as vscode from 'vscode';
import {
  DownloadTesterError,
  type ExecuteInitializeUseCase,
  type GetDefaultProjectNameQuery,
  type InitializeOptions,
  type PrepareInitializeUseCase,
} from '../../application/initializeUseCase';
import type { VSCodeUIContext } from '../vscodeUIContext';

/**
 * pahcer init を実行するための初期化WebView
 */
export class InitializationWebViewController implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly vscodeUIContext: VSCodeUIContext,
    private readonly getDefaultProjectNameQuery: GetDefaultProjectNameQuery,
    private readonly prepareInitializeUseCase: PrepareInitializeUseCase,
    private readonly executeInitializeUseCase: ExecuteInitializeUseCase,
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

  private async handleInitialize(options: InitializeOptions): Promise<void> {
    try {
      if (options.testerUrl) {
        vscode.window.showInformationMessage('ローカルテスターをダウンロード中...');
      }

      const preparation = await this.prepareInitializeUseCase.execute(options);
      let finalOptions = options;

      if (preparation.type === 'requires-confirmation') {
        const detectedType = preparation.detectedInteractive
          ? 'インタラクティブ問題'
          : '非インタラクティブ問題';
        const userSelectedType = preparation.options.isInteractive
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
            title: preparation.detectedInteractive
              ? 'インタラクティブに変更'
              : '非インタラクティブに変更',
          },
          { title: 'このまま続行', isCloseAffordance: true },
        );

        finalOptions = {
          ...preparation.options,
          isInteractive:
            answer !== undefined && answer.title !== 'このまま続行'
              ? preparation.detectedInteractive
              : preparation.options.isInteractive,
        };
      }

      const { job } = await this.executeInitializeUseCase.execute(finalOptions);
      await job.wait();

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

    const defaultProjectName = await this.getDefaultProjectNameQuery.execute();

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
