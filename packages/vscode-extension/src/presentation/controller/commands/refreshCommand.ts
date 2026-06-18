import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * リフレッシュコマンドハンドラ
 */
export function refreshCommand(treeViewController: PahcerTreeViewController): () => void {
  return () => {
    treeViewController.refresh();
  };
}
