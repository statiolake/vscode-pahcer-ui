import type { VSCodeUIContext } from '../../vscodeUIContext';

/**
 * オプション付きテスト実行コマンドハンドラ
 */
export function runWithOptionsCommand(vscodeUIContext: VSCodeUIContext): () => Promise<void> {
  return async () => {
    await vscodeUIContext.setShowRunOptions(true);
  };
}
