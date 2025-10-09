import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 出力ファイルのリポジトリ
 */
export class OutputFileRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 最新の出力ファイルのパスを取得
	 */
	getLatestOutputPath(seed: number): string {
		return path.join(this.workspaceRoot, 'tools', 'out', `${String(seed).padStart(4, '0')}.txt`);
	}

	/**
	 * 過去の実行結果の出力ファイルのパスを取得
	 */
	getOutputPath(resultId: string, seed: number): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'out',
			`${String(seed).padStart(4, '0')}.txt`,
		);
	}

	/**
	 * 出力ファイルを読み込む
	 */
	async load(seed: number, resultId?: string): Promise<string | null> {
		const outputPath = resultId
			? this.getOutputPath(resultId, seed)
			: this.getLatestOutputPath(seed);

		if (!fs.existsSync(outputPath)) {
			return null;
		}

		try {
			return fs.readFileSync(outputPath, 'utf-8');
		} catch (e) {
			console.error(`Failed to read output file for seed ${seed}:`, e);
			return null;
		}
	}

	/**
	 * 出力ファイルが存在するかチェック
	 */
	exists(seed: number, resultId?: string): boolean {
		const outputPath = resultId
			? this.getOutputPath(resultId, seed)
			: this.getLatestOutputPath(seed);
		return fs.existsSync(outputPath);
	}

	/**
	 * 出力ファイルをコピーし、必要に応じてコミットハッシュを保存する
	 */
	async copyOutputFiles(resultId: string, commitHash?: string): Promise<void> {
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

		// Save commit hash if available
		if (commitHash) {
			const metaPath = path.join(destDir, 'meta.json');
			const metadata = { comment: '', commitHash };

			// Load existing metadata if any
			if (fs.existsSync(metaPath)) {
				try {
					const existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
					metadata.comment = existing.comment || '';
				} catch (e) {
					// Ignore errors
				}
			}

			fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
		}
	}
}
