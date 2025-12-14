import type { IKeybindingContextAdapter } from '../../../domain/interfaces/IKeybindingContextAdapter';

/**
 * 初期化コマンドハンドラ
 * 初期化WebViewを表示する
 */
export function initializeCommand(
  keybindingContextAdapter: IKeybindingContextAdapter,
): () => Promise<void> {
  return async () => {
    // Show initialization WebView by switching context
    await keybindingContextAdapter.setShowInitialization(true);
  };
}
