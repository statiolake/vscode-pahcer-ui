import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * ソート順変更コマンドハンドラ
 */
export async function changeSortOrderCommand(
	treeViewController: PahcerTreeViewController,
): Promise<void> {
	const mode = treeViewController.getGroupingMode();

	if (mode === 'byExecution') {
		const currentOrder = treeViewController.getExecutionSortOrder();
		const options = [
			{ label: 'シードの昇順', value: 'seedAsc' as const },
			{ label: 'シードの降順', value: 'seedDesc' as const },
			{ label: '相対スコアの昇順', value: 'relativeScoreAsc' as const },
			{ label: '相対スコアの降順', value: 'relativeScoreDesc' as const },
			{ label: '絶対スコアの昇順', value: 'absoluteScoreAsc' as const },
			{ label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
		});

		if (selected) {
			await treeViewController.setExecutionSortOrder(selected.value);
		}
	} else {
		const currentOrder = treeViewController.getSeedSortOrder();
		const options = [
			{ label: '実行の昇順', value: 'executionAsc' as const },
			{ label: '実行の降順', value: 'executionDesc' as const },
			{ label: '絶対スコアの昇順', value: 'absoluteScoreAsc' as const },
			{ label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
		});

		if (selected) {
			await treeViewController.setSeedSortOrder(selected.value);
		}
	}
}
