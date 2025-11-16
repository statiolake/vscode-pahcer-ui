import * as vscode from 'vscode';
import type { InOutFilesAdapter } from '../../../infrastructure/inOutFilesAdapter';
import type { PahcerTreeItem } from '../pahcerTreeViewController';

/**
 * 入力ファイルを開くコマンドハンドラ
 *
 * コントローラ層の責務:
 * - UIイベント（TreeItemクリック）を処理
 * - インフラ層にファイルパス解決を委譲
 * - エディタ操作
 */
export function openInputFileCommand(
	inOutFilesAdapter: InOutFilesAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed) {
			return;
		}

		const inputPath = inOutFilesAdapter.getNonArchivedPath('in', item.seed);
		try {
			const document = await vscode.workspace.openTextDocument(inputPath);
			await vscode.window.showTextDocument(document);
		} catch (e) {
			vscode.window.showErrorMessage(`ファイルを開けませんでした: ${inputPath}: ${e}`);
		}
	};
}

/**
 * 出力ファイルを開くコマンドハンドラ
 *
 * コントローラ層の責務:
 * - UIイベント（TreeItemクリック）を処理
 * - インフラ層にファイルパス解決を委譲
 * - フォールバック処理のロジック
 * - エディタ操作
 */
export function openOutputFileCommand(
	inOutFilesAdapter: InOutFilesAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		const outputPath = inOutFilesAdapter.getArchivedPath('out', {
			executionId: item.executionId,
			seed: item.seed,
		});
		try {
			const document = await vscode.workspace.openTextDocument(outputPath);
			await vscode.window.showTextDocument(document);
		} catch (e) {
			vscode.window.showErrorMessage(`ファイルを開けませんでした: ${outputPath}: ${e}`);
		}
	};
}

/**
 * エラーファイルを開くコマンドハンドラ
 *
 * コントローラ層の責務:
 * - UIイベント（TreeItemクリック）を処理
 * - インフラ層にファイルパス解決を委譲
 * - フォールバック処理のロジック
 * - エディタ操作
 */
export function openErrorFileCommand(
	inOutFilesAdapter: InOutFilesAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		const errorPath = inOutFilesAdapter.getArchivedPath('err', {
			executionId: item.executionId,
			seed: item.seed,
		});
		try {
			const document = await vscode.workspace.openTextDocument(errorPath);
			await vscode.window.showTextDocument(document);
		} catch (e) {
			vscode.window.showErrorMessage(`ファイルを開けませんでした: ${errorPath}: ${e}`);
		}
	};
}
