import type { IKeybindingContextAdapter } from '../../../domain/interfaces/IKeybindingContextAdapter';

/**
 * オプション付きテスト実行コマンドハンドラ
 */
export function runWithOptionsCommand(
  keybindingContextAdapter: IKeybindingContextAdapter,
): () => Promise<void> {
  return async () => {
    await keybindingContextAdapter.setShowRunOptions(true);
  };
}
