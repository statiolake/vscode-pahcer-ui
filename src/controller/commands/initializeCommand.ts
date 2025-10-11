import type { ContextAdapter } from '../../infrastructure/contextAdapter';

/**
 * 初期化コマンドハンドラ
 * 初期化WebViewを表示する
 */
export function initializeCommand(contextAdapter: ContextAdapter): () => Promise<void> {
	return async () => {
		// Show initialization WebView by switching context
		await contextAdapter.setShowInitialization(true);
	};
}
