import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PahcerResult, PahcerResultWithId } from '../domain/models/pahcerResult';
import type { TestCase } from '../domain/models/testCase';

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
function convertToDomainModel(raw: RawPahcerResult): PahcerResult {
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
		cases: raw.cases.map((c) => ({
			seed: c.seed,
			score: c.score,
			relativeScore: c.relative_score,
			executionTime: c.execution_time,
			errorMessage: c.error_message,
		})),
	};
}

/**
 * Pahcer実行結果のリポジトリ
 */
export class PahcerResultRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 最新N件の実行結果を読み込む
	 */
	async loadLatestResults(limit = 10): Promise<PahcerResultWithId[]> {
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
					result: convertToDomainModel(raw),
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
			return convertToDomainModel(raw);
		} catch (e) {
			console.error(`Failed to load result ${resultId}:`, e);
			return null;
		}
	}
}
