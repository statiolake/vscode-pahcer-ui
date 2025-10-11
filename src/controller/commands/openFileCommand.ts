import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { PahcerTreeItem } from '../pahcerTreeViewController';

/**
 * 指定されたseedの入力ファイルを開くコマンドハンドラ
 */
export function openInputFileCommand(workspaceRoot: string): (item: PahcerTreeItem) => void {
	return (item: PahcerTreeItem) => {
		if (!item.seed) {
			return;
		}

		const seedStr = String(item.seed).padStart(4, '0');
		const inputPath = path.join(workspaceRoot, 'tools', 'in', `${seedStr}.txt`);

		if (!fs.existsSync(inputPath)) {
			vscode.window.showErrorMessage(`入力ファイルが見つかりません: ${inputPath}`);
			return;
		}

		vscode.workspace.openTextDocument(inputPath).then((document) => {
			vscode.window.showTextDocument(document);
		});
	};
}

/**
 * 指定されたseedの出力ファイルを開くコマンドハンドラ
 */
export function openOutputFileCommand(workspaceRoot: string): (item: PahcerTreeItem) => void {
	return (item: PahcerTreeItem) => {
		if (
			!item ||
			typeof item !== 'object' ||
			!('seed' in item) ||
			typeof item.seed !== 'number' ||
			!('executionId' in item) ||
			typeof item.executionId !== 'string'
		) {
			return;
		}

		const seedStr = String(item.seed).padStart(4, '0');

		// First, try to open from .pahcer-ui/results/result_{resultId}/out/{seed}.txt
		const savedOutputPath = path.join(
			workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${item.executionId}`,
			'out',
			`${seedStr}.txt`,
		);

		if (fs.existsSync(savedOutputPath)) {
			vscode.workspace.openTextDocument(savedOutputPath).then((document) => {
				vscode.window.showTextDocument(document);
			});
			return;
		}

		// Fallback to tools/out/{seed}.txt (latest execution)
		const outputPath = path.join(workspaceRoot, 'tools', 'out', `${seedStr}.txt`);

		if (!fs.existsSync(outputPath)) {
			vscode.window.showErrorMessage(`出力ファイルが見つかりません: ${outputPath}`);
			return;
		}

		vscode.workspace.openTextDocument(outputPath).then((document) => {
			vscode.window.showTextDocument(document);
		});
	};
}

/**
 * 指定されたseedのエラーファイルを開くコマンドハンドラ
 */
export function openErrorFileCommand(workspaceRoot: string): (item: PahcerTreeItem) => void {
	return (item: PahcerTreeItem) => {
		if (
			!item ||
			typeof item !== 'object' ||
			!('seed' in item) ||
			typeof item.seed !== 'number' ||
			!('executionId' in item) ||
			typeof item.executionId !== 'string'
		) {
			return;
		}

		const seedStr = String(item.seed).padStart(4, '0');

		// First, try to open from .pahcer-ui/results/result_{resultId}/err/{seed}.txt
		const savedErrorPath = path.join(
			workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${item.executionId}`,
			'err',
			`${seedStr}.txt`,
		);

		if (fs.existsSync(savedErrorPath)) {
			vscode.workspace.openTextDocument(savedErrorPath).then((document) => {
				vscode.window.showTextDocument(document);
			});
			return;
		}

		// Fallback to tools/err/{seed}.txt (latest execution)
		const errorPath = path.join(workspaceRoot, 'tools', 'err', `${seedStr}.txt`);

		if (!fs.existsSync(errorPath)) {
			vscode.window.showErrorMessage(`エラーファイルが見つかりません: ${errorPath}`);
			return;
		}

		vscode.workspace.openTextDocument(errorPath).then((document) => {
			vscode.window.showTextDocument(document);
		});
	};
}
