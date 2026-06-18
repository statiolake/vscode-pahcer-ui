import type { OpenCaseFileUseCase } from '@pahcer/core/application/openCaseFileUseCase';
import * as vscode from 'vscode';
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
  openCaseFileUseCase: OpenCaseFileUseCase,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    if (item.seed == null) {
      return;
    }

    const inputPath = openCaseFileUseCase.resolvePath({ kind: 'input', seed: item.seed });
    if (!inputPath) {
      return;
    }
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
  openCaseFileUseCase: OpenCaseFileUseCase,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    if (item.seed === null || item.seed === undefined || !item.executionId) {
      return;
    }

    const outputPath = openCaseFileUseCase.resolvePath({
      kind: 'output',
      executionId: item.executionId,
      seed: item.seed,
    });
    if (!outputPath) {
      return;
    }
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
  openCaseFileUseCase: OpenCaseFileUseCase,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    if (item.seed === null || item.seed === undefined || !item.executionId) {
      return;
    }

    const errorPath = openCaseFileUseCase.resolvePath({
      kind: 'error',
      executionId: item.executionId,
      seed: item.seed,
    });
    if (!errorPath) {
      return;
    }
    try {
      const document = await vscode.workspace.openTextDocument(errorPath);
      await vscode.window.showTextDocument(document);
    } catch (e) {
      vscode.window.showErrorMessage(`ファイルを開けませんでした: ${errorPath}: ${e}`);
    }
  };
}
