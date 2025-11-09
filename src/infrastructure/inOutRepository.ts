import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * ファイルタイプ
 */
export type FileType = 'in' | 'out' | 'err';

/**
 * 入力・出力・エラーファイルを統合管理するリポジトリ
 *
 * 責務:
 * - ファイルパスの一元管理（tools/in, tools/out, tools/err, .pahcer-ui/results）
 * - ファイルの読み込み・存在確認
 * - 実行結果のコピー
 *
 * 責務外（ユースケース層で実装）:
 * - ファイルの解析（TestCaseへの変換）
 */
export class InOutRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * Seed番号を4桁の文字列にフォーマット
	 */
	private formatSeed(seed: number): string {
		return String(seed).padStart(4, '0');
	}

	/**
	 * 最新のファイルパスを取得（tools/{type}/nnnn.txt）
	 */
	getLatestPath(type: FileType, seed: number): string {
		return path.join(this.workspaceRoot, 'tools', type, `${this.formatSeed(seed)}.txt`);
	}

	/**
	 * 過去の実行結果のファイルパスを取得（.pahcer-ui/results/result_{id}/{type}/nnnn.txt）
	 */
	getArchivedPath(type: FileType, resultId: string, seed: number): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			type,
			`${this.formatSeed(seed)}.txt`,
		);
	}

	/**
	 * ファイルパスを取得（resultIdがあればアーカイブ、なければ最新）
	 */
	getPath(type: FileType, seed: number, resultId?: string): string {
		return resultId ? this.getArchivedPath(type, resultId, seed) : this.getLatestPath(type, seed);
	}

	/**
	 * ファイルが存在するかチェック
	 */
	exists(type: FileType, seed: number, resultId?: string): boolean {
		const filePath = this.getPath(type, seed, resultId);
		return fs.existsSync(filePath);
	}

	/**
	 * ファイルを読み込む
	 */
	async load(type: FileType, seed: number, resultId?: string): Promise<string | null> {
		const filePath = this.getPath(type, seed, resultId);

		if (!fs.existsSync(filePath)) {
			return null;
		}

		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch (e) {
			console.error(`Failed to read ${type} file for seed ${seed}:`, e);
			return null;
		}
	}

	/**
	 * 出力ファイルをコピー
	 * 注：解析処理はユースケース層で実装
	 */
	async copyOutputFiles(resultId: string): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);

		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Copy tools/out directory
		const toolsOutDir = path.join(this.workspaceRoot, 'tools', 'out');
		if (fs.existsSync(toolsOutDir)) {
			const outDestDir = path.join(destDir, 'out');
			fs.cpSync(toolsOutDir, outDestDir, { recursive: true });
		}

		// Copy tools/err directory
		const toolsErrDir = path.join(this.workspaceRoot, 'tools', 'err');
		if (fs.existsSync(toolsErrDir)) {
			const errDestDir = path.join(destDir, 'err');
			fs.cpSync(toolsErrDir, errDestDir, { recursive: true });
		}
	}
}
