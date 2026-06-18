import * as vscode from 'vscode';
import type { VSCodeUIContext } from '../../vscodeUIContext';

/**
 * 初期化コマンドハンドラ
 * 初期化WebViewを表示する
 */
export function initializeCommand(vscodeUIContext: VSCodeUIContext): () => Promise<void> {
  return async () => {
    try {
      // Show initialization WebView by switching context
      await vscodeUIContext.setShowInitialization(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`初期化画面の表示に失敗しました: ${errorMessage}`);
    }
  };
}
