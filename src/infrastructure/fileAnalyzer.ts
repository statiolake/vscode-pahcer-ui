import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { parseStderrVariables as domainParseStderr } from '../domain/services/stderrParser';

/**
 * ファイル解析ユーティリティ
 * ストリーミング処理で大きなファイルにも対応
 */
export class FileAnalyzer {
	/**
	 * ファイルの1行目だけを読み込む（ストリーミング）
	 */
	static async readFirstLine(filePath: string): Promise<string> {
		if (!fs.existsSync(filePath)) {
			return '';
		}

		const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		try {
			for await (const line of rl) {
				// 最初の行だけ読んで即座にストリームを閉じる
				rl.close();
				fileStream.close();
				return line.trim();
			}
			return '';
		} catch (error) {
			console.warn(`Failed to read first line from ${filePath}:`, error);
			return '';
		}
	}

	/**
	 * ファイルの先頭N行と末尾N行を読み込む（ストリーミング）
	 */
	static async readHeadAndTail(
		filePath: string,
		headLines = 100,
		tailLines = 100,
	): Promise<{ head: string; tail: string }> {
		if (!fs.existsSync(filePath)) {
			return { head: '', tail: '' };
		}

		const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		const head: string[] = [];
		const tail: string[] = [];
		let lineCount = 0;

		try {
			for await (const line of rl) {
				lineCount++;

				// 先頭100行はそのまま保存
				if (lineCount <= headLines) {
					head.push(line);
				} else {
					// 末尾100行用のリングバッファ
					tail.push(line);
					if (tail.length > tailLines) {
						tail.shift(); // 最古の行を削除
					}
				}
			}

			// ファイルが200行以下なら先頭のみ返す（tailは空）
			if (lineCount <= headLines + tailLines) {
				return { head: head.join('\n'), tail: '' };
			}

			// それ以外は先頭100行と末尾100行を分けて返す
			return { head: head.join('\n'), tail: tail.join('\n') };
		} catch (error) {
			console.warn(`Failed to read head and tail from ${filePath}:`, error);
			return { head: '', tail: '' };
		} finally {
			rl.close();
			fileStream.close();
		}
	}

	/**
	 * 複数のファイルの1行目を並列読み込み
	 */
	static async readFirstLinesParallel(filePaths: string[]): Promise<Map<string, string>> {
		const results = await Promise.all(
			filePaths.map(async (path) => ({
				path,
				content: await FileAnalyzer.readFirstLine(path),
			})),
		);

		const map = new Map<string, string>();
		for (const { path, content } of results) {
			map.set(path, content);
		}
		return map;
	}

	/**
	 * 複数のファイルの先頭・末尾を並列読み込み
	 */
	static async readHeadAndTailParallel(
		filePaths: string[],
		headLines = 100,
		tailLines = 100,
	): Promise<Map<string, { head: string; tail: string }>> {
		const results = await Promise.all(
			filePaths.map(async (path) => ({
				path,
				content: await FileAnalyzer.readHeadAndTail(path, headLines, tailLines),
			})),
		);

		const map = new Map<string, { head: string; tail: string }>();
		for (const { path, content } of results) {
			map.set(path, content);
		}
		return map;
	}

	/**
	 * stderrファイルから変数を抽出（$varname = value）
	 * 先頭100行と末尾100行のみをストリーミングで読み込んでパース
	 */
	static async parseStderrVariables(
		filePath: string,
		headLines = 100,
		tailLines = 100,
	): Promise<Record<string, number>> {
		const { head, tail } = await FileAnalyzer.readHeadAndTail(filePath, headLines, tailLines);

		// Parse head first
		const variables = domainParseStderr(head);

		// Parse tail (these override earlier values)
		const tailVars = domainParseStderr(tail);
		for (const [key, value] of Object.entries(tailVars)) {
			variables[key] = value;
		}

		return variables;
	}

	/**
	 * 複数のstderrファイルから変数を並列抽出
	 */
	static async parseStderrVariablesParallel(
		filePaths: string[],
		headLines = 100,
		tailLines = 100,
	): Promise<Map<string, Record<string, number>>> {
		const results = await Promise.all(
			filePaths.map(async (path) => ({
				path,
				variables: await FileAnalyzer.parseStderrVariables(path, headLines, tailLines),
			})),
		);

		const map = new Map<string, Record<string, number>>();
		for (const { path, variables } of results) {
			map.set(path, variables);
		}
		return map;
	}
}
