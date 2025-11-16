import type { Execution } from '../models/execution';
import type { TestCase } from '../models/testCase';

// Re-export GroupingMode from sortingService
export type { GroupingMode } from './sortingService';

/**
 * Seedごとにグルーピングされたデータ
 */
export interface SeedGroup {
	seed: number;
	executions: Array<{
		execution: Execution;
		testCase: TestCase;
	}>;
}

/**
 * テストケースとExecutionをSeedごとにグルーピング（純粋関数）
 * @param testCases テストケース配列
 * @param executions 実行メタデータ配列
 */
export function groupBySeed(testCases: TestCase[], executions: Execution[]): SeedGroup[] {
	const seedMap = new Map<
		number,
		Array<{
			execution: Execution;
			testCase: TestCase;
		}>
	>();

	// executionId -> Execution のマップを作成
	const executionMap = new Map(executions.map((e) => [e.id, e]));

	for (const testCase of testCases) {
		const execution = executionMap.get(testCase.id.executionId);
		if (!execution) {
			continue;
		}

		const executionList = seedMap.get(testCase.id.seed) || [];
		executionList.push({
			execution,
			testCase,
		});
		seedMap.set(testCase.id.seed, executionList);
	}

	const groups: SeedGroup[] = [];
	for (const [seed, executionList] of seedMap.entries()) {
		groups.push({ seed, executions: executionList });
	}

	// Seed順にソート
	groups.sort((a, b) => a.seed - b.seed);

	return groups;
}
