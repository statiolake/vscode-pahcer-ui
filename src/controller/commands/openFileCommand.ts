import * as vscode from 'vscode';
import type { InOutRepository } from '../../infrastructure/inOutRepository';
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
	inOutRepository: InOutRepository,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed) {
			return;
		}

		if (!inOutRepository.exists('in', item.seed)) {
			vscode.window.showErrorMessage(`入力ファイルが見つかりません: ${item.seed}`);
			return;
		}

		const inputPath = inOutRepository.getPath('in', item.seed);
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
	inOutRepository: InOutRepository,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		if (!inOutRepository.exists('out', item.seed, item.executionId)) {
			vscode.window.showErrorMessage(
				`出力ファイルが見つかりません: ${item.seed}@${item.executionId}`,
			);
			return;
		}

		const outputPath = inOutRepository.getPath('out', item.seed, item.executionId);
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
	inOutRepository: InOutRepository,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		if (!inOutRepository.exists('err', item.seed, item.executionId)) {
			vscode.window.showErrorMessage(
				`エラーファイルが見つかりません: ${item.seed}@${item.executionId}`,
			);
			return;
		}

		const errorPath = inOutRepository.getPath('err', item.seed, item.executionId);
		try {
			const document = await vscode.workspace.openTextDocument(errorPath);
			await vscode.window.showTextDocument(document);
		} catch (e) {
			vscode.window.showErrorMessage(`ファイルを開けませんでした: ${errorPath}: ${e}`);
		}
	};
}
