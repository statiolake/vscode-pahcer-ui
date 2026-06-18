import * as vscode from 'vscode';
import type { VSCodeUIContext } from '../../vscodeUIContext';

/**
 * オプション付きテスト実行コマンドハンドラ
 */
export function runWithOptionsCommand(vscodeUIContext: VSCodeUIContext): () => Promise<void> {
  return async () => {
    try {
      await vscodeUIContext.setShowRunOptions(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`実行オプション画面の表示に失敗しました: ${errorMessage}`);
    }
  };
}
