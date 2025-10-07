import type { PahcerResult, PahcerResultWithId } from '../models/pahcerResult';
import type { TestCase } from '../models/testCase';

// Re-export GroupingMode from sortingService
export type { GroupingMode } from './sortingService';

/**
 * 実行ごとにグルーピングされたデータ
 */
export interface ExecutionGroup {
	resultId: string;
	result: PahcerResult;
	cases: TestCase[];
}

/**
 * Seedごとにグルーピングされたデータ
 */
export interface SeedGroup {
	seed: number;
	executions: Array<{
		resultId: string;
		file: string;
		result: PahcerResult;
		testCase: TestCase;
	}>;
}

/**
 * 実行結果を実行ごとにグルーピング（純粋関数）
 */
export function groupByExecution(results: PahcerResultWithId[]): ExecutionGroup[] {
	return results.map((item) => ({
		resultId: item.id,
		result: item.result,
		cases: item.result.cases,
	}));
}

/**
 * 実行結果をSeedごとにグルーピング（純粋関数）
 */
export function groupBySeed(results: PahcerResultWithId[]): SeedGroup[] {
	const seedMap = new Map<
		number,
		Array<{
			resultId: string;
			file: string;
			result: PahcerResult;
			testCase: TestCase;
		}>
	>();

	for (const item of results) {
		for (const testCase of item.result.cases) {
			const executions = seedMap.get(testCase.seed) || [];
			executions.push({
				resultId: item.id,
				file: `result_${item.id}.json`,
				result: item.result,
				testCase,
			});
			seedMap.set(testCase.seed, executions);
		}
	}

	const groups: SeedGroup[] = [];
	for (const [seed, executions] of seedMap.entries()) {
		groups.push({ seed, executions });
	}

	// Seed順にソート
	groups.sort((a, b) => a.seed - b.seed);

	return groups;
}
