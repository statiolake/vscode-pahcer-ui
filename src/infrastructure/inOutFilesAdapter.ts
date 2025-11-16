import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TestCaseId } from '../domain/models/testCase';
import { asErrnoException } from '../util/lang';

/**
 * ファイルタイプ
 */
export type FileType = 'in' | 'out' | 'err';

/**
 * 入力・出力・エラーファイルの処理を統合管理するアダプタ
 *
 * 責務:
 * - ファイルパスの一元管理（tools/in, tools/out, tools/err, .pahcer-ui/results）
 * - ファイルの読み込み・存在確認
 * - 実行結果のコピー
 *
 * 責務外（ユースケース層で実装）:
 * - ファイルの解析（TestCaseへの変換）
 */
export class InOutFilesAdapter {
	constructor(private workspaceRoot: string) {}

	/**
	 * まだアーカイブされる前の Pahcer から出力されたファイルそのもののパスを取得
	 */
	getNonArchivedPath(type: FileType, seed: number): string {
		return path.join(this.workspaceRoot, 'tools', type, `${this.formatSeed(seed)}.txt`);
	}

	/**
	 * 過去の実行結果のファイルパスを取得（.pahcer-ui/results/result_{id}/{type}/nnnn.txt）
	 * 入力ファイルはアーカイブされないため、'in' タイプは除外
	 */
	getArchivedPath(type: Exclude<FileType, 'in'>, id: TestCaseId): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${id.executionId}`,
			type,
			`${this.formatSeed(id.seed)}.txt`,
		);
	}

	/**
	 * アーカイブされたファイルを読み込む
	 * 入力ファイルはアーカイブされないため、'in' タイプは除外
	 * @returns ファイル内容、ファイルが見つからない場合は空文字列
	 */
	async loadArchived(type: Exclude<FileType, 'in'>, id: TestCaseId): Promise<string> {
		const filePath = this.getArchivedPath(type, id);
		try {
			return await fs.readFile(filePath, 'utf-8');
		} catch (e) {
			if (e instanceof Error && asErrnoException(e).code === 'ENOENT') {
				return '';
			}
			throw e;
		}
	}

	/**
	 * 入力ファイルを読み込む（tools/in から直接取得）
	 * 入力ファイルは不変なため、常に最新のファイルから読み込む
	 * @returns ファイル内容、ファイルが見つからない場合は空文字列
	 */
	async loadIn(seed: number): Promise<string> {
		const filePath = this.getNonArchivedPath('in', seed);
		try {
			return await fs.readFile(filePath, 'utf-8');
		} catch (e) {
			if (e instanceof Error && asErrnoException(e).code === 'ENOENT') {
				return '';
			}
			throw e;
		}
	}

	/**
	 * 出力ファイルをアーカイブ（out, err のみ）
	 * 入力ファイル (in) は不変なため、アーカイブせず tools/in から常に取得
	 * 注：解析処理はユースケース層で実装
	 */
	async archiveOutputs(executionId: string): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${executionId}`);

		await fs.mkdir(destDir, { recursive: true });

		// Copy tools/out directory
		const toolsOutDir = path.join(this.workspaceRoot, 'tools', 'out');

		try {
			const outDestDir = path.join(destDir, 'out');
			await fs.cp(toolsOutDir, outDestDir, { recursive: true });
		} catch (e) {
			if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
				throw e;
			}

			// ファイルが存在しない場合は続行
		}

		// Copy tools/err directory
		const toolsErrDir = path.join(this.workspaceRoot, 'tools', 'err');
		try {
			const errDestDir = path.join(destDir, 'err');
			await fs.cp(toolsErrDir, errDestDir, { recursive: true });
		} catch (e) {
			if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
				throw e;
			}

			// ファイルが存在しない場合は続行
		}
	}

	/**
	 * Seed番号を4桁の文字列にフォーマット
	 */
	private formatSeed(seed: number): string {
		return String(seed).padStart(4, '0');
	}
}
