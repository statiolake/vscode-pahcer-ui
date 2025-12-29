import * as vscode from 'vscode';
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
    try {
      await appUIConfig.setGroupingMode('bySeed');
      treeViewController.refresh();
      await updateContext();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`モード切り替えに失敗しました: ${errorMessage}`);
    }
  };
}

export function switchToExecutionCommand(
  appUIConfig: AppUIConfig,
  treeViewController: PahcerTreeViewController,
  updateContext: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    try {
      await appUIConfig.setGroupingMode('byExecution');
      treeViewController.refresh();
      await updateContext();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`モード切り替えに失敗しました: ${errorMessage}`);
    }
  };
}
