import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PahcerResult, PahcerResultWithId } from '../domain/models/pahcerResult';

/**
 * JSONファイルから読み込んだ生データの型
 */
interface RawPahcerResult {
	start_time: string;
	case_count: number;
	total_score: number;
	total_score_log10: number;
	total_relative_score: number;
	max_execution_time: number;
	comment: string;
	tag_name: string | null;
	wa_seeds: number[];
	cases: Array<{
		seed: number;
		score: number;
		relative_score: number;
		execution_time: number;
		error_message: string;
	}>;
}

/**
 * 生データをドメインモデルに変換
 */
function convertToDomainModel(
	raw: RawPahcerResult,
	resultId: string,
	workspaceRoot: string,
): PahcerResult {
	return {
		startTime: raw.start_time,
		caseCount: raw.case_count,
		totalScore: raw.total_score,
		totalScoreLog10: raw.total_score_log10,
		totalRelativeScore: raw.total_relative_score,
		maxExecutionTime: raw.max_execution_time,
		comment: raw.comment,
		tagName: raw.tag_name,
		waSeeds: raw.wa_seeds,
		cases: raw.cases.map((c) => {
			// Check if output file exists
			const seedStr = String(c.seed).padStart(4, '0');
			const outputPath = path.join(
				workspaceRoot,
				'.pahcer-ui',
				'results',
				`result_${resultId}`,
				'out',
				`${seedStr}.txt`,
			);
			const foundOutput = fs.existsSync(outputPath);

			return {
				seed: c.seed,
				score: c.score,
				relativeScore: c.relative_score,
				executionTime: c.execution_time,
				errorMessage: c.error_message,
				foundOutput,
			};
		}),
	};
}

/**
 * Pahcer実行結果のリポジトリ
 */
export class PahcerResultRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 最新N件の実行結果を読み込む（デフォルトは全件）
	 */
	async loadLatestResults(limit = Number.POSITIVE_INFINITY): Promise<PahcerResultWithId[]> {
		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [];
		}

		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse()
			.slice(0, limit);

		const results: PahcerResultWithId[] = [];

		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const raw: RawPahcerResult = JSON.parse(content);
				const resultId = file.replace(/^result_(.+)\.json$/, '$1');

				results.push({
					id: resultId,
					result: convertToDomainModel(raw, resultId, this.workspaceRoot),
				});
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		return results;
	}

	/**
	 * 特定の実行結果を読み込む
	 */
	async loadResult(resultId: string): Promise<PahcerResult | null> {
		const jsonPath = path.join(this.workspaceRoot, 'pahcer', 'json', `result_${resultId}.json`);

		if (!fs.existsSync(jsonPath)) {
			return null;
		}

		try {
			const content = fs.readFileSync(jsonPath, 'utf-8');
			const raw: RawPahcerResult = JSON.parse(content);
			return convertToDomainModel(raw, resultId, this.workspaceRoot);
		} catch (e) {
			console.error(`Failed to load result ${resultId}:`, e);
			return null;
		}
	}

	/**
	 * コメントを更新する（pahcer本体のJSONファイルを直接書き換え）
	 */
	async updateComment(resultId: string, comment: string): Promise<void> {
		const jsonPath = path.join(this.workspaceRoot, 'pahcer', 'json', `result_${resultId}.json`);

		if (!fs.existsSync(jsonPath)) {
			throw new Error(`Result file not found: ${jsonPath}`);
		}

		try {
			// JSONファイルを読み込む
			const content = fs.readFileSync(jsonPath, 'utf-8');
			const raw: RawPahcerResult = JSON.parse(content);

			// commentフィールドを更新
			raw.comment = comment;

			// JSONファイルに書き戻す（インデントを保持）
			fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2), 'utf-8');
		} catch (e) {
			console.error(`Failed to update comment for ${resultId}:`, e);
			throw e;
		}
	}
}
