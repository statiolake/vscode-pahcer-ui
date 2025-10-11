import * as vscode from 'vscode';
import type { GroupingMode } from '../../domain/services/sortingService';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * モード切り替えコマンドハンドラ
 */
export function switchToSeedCommand(
	treeViewController: PahcerTreeViewController,
	updateContext: () => Promise<void>,
): () => Promise<void> {
	return async () => {
		await treeViewController.setGroupingMode('bySeed');
		await updateContext();
	};
}

export function switchToExecutionCommand(
	treeViewController: PahcerTreeViewController,
	updateContext: () => Promise<void>,
): () => Promise<void> {
	return async () => {
		await treeViewController.setGroupingMode('byExecution');
		await updateContext();
	};
}
