import type { PahcerResult } from '../models/pahcerResult';
import type { TestCase } from '../models/testCase';

/**
 * Seed別の統計情報
 */
export interface SeedStats {
	seed: number;
	count: number;
	totalScore: number;
	totalRelativeScore: number;
	averageScore: number;
	averageRelativeScore: number;
}

/**
 * Seed別の統計を計算する（純粋関数）
 */
export function calculateSeedStats(results: PahcerResult[]): Map<number, SeedStats> {
	const seedMap = new Map<number, { count: number; totalScore: number; totalRel: number }>();

	for (const result of results) {
		for (const testCase of result.cases) {
			const existing = seedMap.get(testCase.seed) || { count: 0, totalScore: 0, totalRel: 0 };
			seedMap.set(testCase.seed, {
				count: existing.count + 1,
				totalScore: existing.totalScore + testCase.score,
				totalRel: existing.totalRel + testCase.relativeScore,
			});
		}
	}

	const statsMap = new Map<number, SeedStats>();
	for (const [seed, data] of seedMap.entries()) {
		statsMap.set(seed, {
			seed,
			count: data.count,
			totalScore: data.totalScore,
			totalRelativeScore: data.totalRel,
			averageScore: data.count > 0 ? data.totalScore / data.count : 0,
			averageRelativeScore: data.count > 0 ? data.totalRel / data.count : 0,
		});
	}

	return statsMap;
}
