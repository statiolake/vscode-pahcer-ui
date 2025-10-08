import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * 指定されたseedの入力/出力/エラーファイルを開く
 */
export async function openInputFile(workspaceRoot: string, seed: number): Promise<void> {
	const seedStr = String(seed).padStart(4, '0');
	const inputPath = path.join(workspaceRoot, 'tools', 'in', `${seedStr}.txt`);

	if (!fs.existsSync(inputPath)) {
		vscode.window.showErrorMessage(`入力ファイルが見つかりません: ${inputPath}`);
		return;
	}

	const document = await vscode.workspace.openTextDocument(inputPath);
	await vscode.window.showTextDocument(document);
}

export async function openOutputFile(
	workspaceRoot: string,
	resultId: string | undefined,
	seed: number,
): Promise<void> {
	const seedStr = String(seed).padStart(4, '0');

	// First, try to open from .pahcer-ui/results/result_{resultId}/out/{seed}.txt
	if (resultId) {
		const savedOutputPath = path.join(
			workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'out',
			`${seedStr}.txt`,
		);

		if (fs.existsSync(savedOutputPath)) {
			const document = await vscode.workspace.openTextDocument(savedOutputPath);
			await vscode.window.showTextDocument(document);
			return;
		}
	}

	// Fallback to tools/out/{seed}.txt (latest execution)
	const outputPath = path.join(workspaceRoot, 'tools', 'out', `${seedStr}.txt`);

	if (!fs.existsSync(outputPath)) {
		vscode.window.showErrorMessage(`出力ファイルが見つかりません: ${outputPath}`);
		return;
	}

	const document = await vscode.workspace.openTextDocument(outputPath);
	await vscode.window.showTextDocument(document);
}

export async function openErrorFile(
	workspaceRoot: string,
	resultId: string | undefined,
	seed: number,
): Promise<void> {
	const seedStr = String(seed).padStart(4, '0');

	// First, try to open from .pahcer-ui/results/result_{resultId}/err/{seed}.txt
	if (resultId) {
		const savedErrorPath = path.join(
			workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'err',
			`${seedStr}.txt`,
		);

		if (fs.existsSync(savedErrorPath)) {
			const document = await vscode.workspace.openTextDocument(savedErrorPath);
			await vscode.window.showTextDocument(document);
			return;
		}
	}

	// Fallback to tools/err/{seed}.txt (latest execution)
	const errorPath = path.join(workspaceRoot, 'tools', 'err', `${seedStr}.txt`);

	if (!fs.existsSync(errorPath)) {
		vscode.window.showErrorMessage(`エラーファイルが見つかりません: ${errorPath}`);
		return;
	}

	const document = await vscode.workspace.openTextDocument(errorPath);
	await vscode.window.showTextDocument(document);
}
