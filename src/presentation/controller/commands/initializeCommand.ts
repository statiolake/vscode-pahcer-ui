import type { VSCodeUIContext } from '../../vscodeUIContext';

/**
 * 初期化コマンドハンドラ
 * 初期化WebViewを表示する
 */
export function initializeCommand(vscodeUIContext: VSCodeUIContext): () => Promise<void> {
  return async () => {
    // Show initialization WebView by switching context
    await vscodeUIContext.setShowInitialization(true);
  };
}
