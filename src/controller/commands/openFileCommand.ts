import type { DialogAdapter } from '../../infrastructure/dialogAdapter';
import type { EditorAdapter } from '../../infrastructure/editorAdapter';
import type { InOutRepository } from '../../infrastructure/inOutRepository';
import type { PahcerTreeItem } from '../pahcerTreeViewController';

/**
 * 入力ファイルを開くコマンドハンドラ
 *
 * コントローラ層の責務:
 * - UIイベント（TreeItemクリック）を処理
 * - インフラ層にファイルパス解決を委譲
 * - エディタ操作をEditorAdapterに委譲
 */
export function openInputFileCommand(
	inOutRepository: InOutRepository,
	editorAdapter: EditorAdapter,
	dialogAdapter: DialogAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed) {
			return;
		}

		if (!inOutRepository.exists('in', item.seed)) {
			dialogAdapter.showErrorMessage(`入力ファイルが見つかりません: ${item.seed}`);
			return;
		}

		const inputPath = inOutRepository.getPath('in', item.seed);
		try {
			await editorAdapter.openFile(inputPath);
		} catch (e) {
			dialogAdapter.showErrorMessage(`ファイルを開けませんでした: ${inputPath}: ${e}`);
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
 * - エディタ操作をEditorAdapterに委譲
 */
export function openOutputFileCommand(
	inOutRepository: InOutRepository,
	editorAdapter: EditorAdapter,
	dialogAdapter: DialogAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		if (!inOutRepository.exists('out', item.seed, item.executionId)) {
			dialogAdapter.showErrorMessage(
				`出力ファイルが見つかりません: ${item.seed}@${item.executionId}`,
			);
			return;
		}

		const outputPath = inOutRepository.getPath('out', item.seed, item.executionId);
		try {
			await editorAdapter.openFile(outputPath);
		} catch (e) {
			dialogAdapter.showErrorMessage(`ファイルを開けませんでした: ${outputPath}: ${e}`);
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
 * - エディタ操作をEditorAdapterに委譲
 */
export function openErrorFileCommand(
	inOutRepository: InOutRepository,
	editorAdapter: EditorAdapter,
	dialogAdapter: DialogAdapter,
): (item: PahcerTreeItem) => Promise<void> {
	return async (item: PahcerTreeItem) => {
		if (!item.seed || !item.executionId) {
			return;
		}

		if (!inOutRepository.exists('err', item.seed, item.executionId)) {
			dialogAdapter.showErrorMessage(
				`エラーファイルが見つかりません: ${item.seed}@${item.executionId}`,
			);
			return;
		}

		const errorPath = inOutRepository.getPath('err', item.seed, item.executionId);
		try {
			await editorAdapter.openFile(errorPath);
		} catch (e) {
			dialogAdapter.showErrorMessage(`ファイルを開けませんでした: ${errorPath}: ${e}`);
		}
	};
}
