import type { ContextAdapter } from '../../../infrastructure/contextAdapter';

/**
 * オプション付きテスト実行コマンドハンドラ
 */
export function runWithOptionsCommand(contextAdapter: ContextAdapter): () => Promise<void> {
  return async () => {
    await contextAdapter.setShowRunOptions(true);
  };
}
