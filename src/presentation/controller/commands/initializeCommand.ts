import type { IContextAdapter } from '../../../domain/interfaces/IContextAdapter';

/**
 * 初期化コマンドハンドラ
 * 初期化WebViewを表示する
 */
export function initializeCommand(contextAdapter: IContextAdapter): () => Promise<void> {
  return async () => {
    // Show initialization WebView by switching context
    await contextAdapter.setShowInitialization(true);
  };
}
