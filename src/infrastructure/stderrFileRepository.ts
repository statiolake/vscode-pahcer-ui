import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * 標準エラー出力ファイルを読み込むリポジトリ
 * 先頭100行と末尾100行のみを読み込む（大きなファイルに対応）
 */
export class StderrFileRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 指定された結果IDとseedの標準エラー出力を読み込む
	 * 先頭100行と末尾100行のみを返す
	 */
	async loadStderr(resultId: string, seed: number): Promise<string> {
		const seedStr = String(seed).padStart(4, '0');
		const stderrPath = path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'err',
			`${seedStr}.txt`,
		);

		try {
			if (!fs.existsSync(stderrPath)) {
				return '';
			}

			const content = await fs.promises.readFile(stderrPath, 'utf-8');
			const lines = content.split('\n');

			// If file has <= 200 lines, return as-is
			if (lines.length <= 200) {
				return content;
			}

			// Otherwise, return first 100 and last 100 lines
			const firstLines = lines.slice(0, 100);
			const lastLines = lines.slice(-100);
			return firstLines.join('\n') + '\n' + lastLines.join('\n');
		} catch (error) {
			console.warn(`Failed to read stderr file: ${stderrPath}`, error);
			return '';
		}
	}

	/**
	 * 複数の結果IDについて、各seedの標準エラー出力を読み込む
	 * 戻り値: resultId -> seed -> stderr
	 */
	async loadStderrForResults(
		resultIds: string[],
		seeds: number[],
	): Promise<Record<string, Record<number, string>>> {
		const stderrData: Record<string, Record<number, string>> = {};

		for (const resultId of resultIds) {
			stderrData[resultId] = {};
			for (const seed of seeds) {
				stderrData[resultId][seed] = await this.loadStderr(resultId, seed);
			}
		}

		return stderrData;
	}
}
