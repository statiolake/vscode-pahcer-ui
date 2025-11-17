import type { IContextAdapter } from '../../../domain/interfaces/IContextAdapter';

/**
 * オプション付きテスト実行コマンドハンドラ
 */
export function runWithOptionsCommand(contextAdapter: IContextAdapter): () => Promise<void> {
  return async () => {
    await contextAdapter.setShowRunOptions(true);
  };
}
