import type { AppUIConfig } from '../../appUIConfig';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * モード切り替えコマンドハンドラ
 */
export function switchToSeedCommand(
  appUIConfig: AppUIConfig,
  treeViewController: PahcerTreeViewController,
  updateContext: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    await appUIConfig.setGroupingMode('bySeed');
    treeViewController.refresh();
    await updateContext();
  };
}

export function switchToExecutionCommand(
  appUIConfig: AppUIConfig,
  treeViewController: PahcerTreeViewController,
  updateContext: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    await appUIConfig.setGroupingMode('byExecution');
    treeViewController.refresh();
    await updateContext();
  };
}
