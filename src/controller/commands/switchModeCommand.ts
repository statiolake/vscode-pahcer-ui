import * as vscode from 'vscode';
import type { GroupingMode } from '../../domain/services/sortingService';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * モード切り替えコマンドハンドラ
 */
export async function switchToSeedCommand(
	treeViewController: PahcerTreeViewController,
	updateContext: () => void,
): Promise<void> {
	await treeViewController.setGroupingMode('bySeed');
	updateContext();
}

export async function switchToExecutionCommand(
	treeViewController: PahcerTreeViewController,
	updateContext: () => void,
): Promise<void> {
	await treeViewController.setGroupingMode('byExecution');
	updateContext();
}
