import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ResultMetadata } from '../domain/models/resultMetadata';

/**
 * 実行結果のメタデータリポジトリ
 */
export class MetadataRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * メタデータを読み込む
	 */
	async load(resultId: string): Promise<ResultMetadata | null> {
		const metaPath = path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'meta.json',
		);

		if (!fs.existsSync(metaPath)) {
			return null;
		}

		try {
			const content = fs.readFileSync(metaPath, 'utf-8');
			return JSON.parse(content);
		} catch (e) {
			console.error(`Failed to load metadata for ${resultId}:`, e);
			return null;
		}
	}

	/**
	 * メタデータを保存する
	 */
	async save(resultId: string, metadata: ResultMetadata): Promise<void> {
		const resultDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);

		if (!fs.existsSync(resultDir)) {
			fs.mkdirSync(resultDir, { recursive: true });
		}

		const metaPath = path.join(resultDir, 'meta.json');

		try {
			fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
		} catch (e) {
			console.error(`Failed to save metadata for ${resultId}:`, e);
			throw e;
		}
	}
}
