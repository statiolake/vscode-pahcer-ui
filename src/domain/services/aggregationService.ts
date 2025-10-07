import type { PahcerResult } from '../models/pahcerResult';
import type { TestCase } from '../models/testCase';

/**
 * 平均スコアを計算する（純粋関数）
 */
export function calculateAverageScore(totalScore: number, caseCount: number): number {
	return caseCount > 0 ? totalScore / caseCount : 0;
}

/**
 * 平均相対スコアを計算する（純粋関数）
 */
export function calculateAverageRelativeScore(
	totalRelativeScore: number,
	caseCount: number,
): number {
	return caseCount > 0 ? totalRelativeScore / caseCount : 0;
}

/**
 * AC数を計算する（純粋関数）
 */
export function calculateAcCount(caseCount: number, waSeeds: number[]): number {
	return caseCount - waSeeds.length;
}

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
			averageScore: calculateAverageScore(data.totalScore, data.count),
			averageRelativeScore: calculateAverageRelativeScore(data.totalRel, data.count),
		});
	}

	return statsMap;
}
