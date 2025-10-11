import type { Execution } from '../models/execution';
import type { TestCase } from '../models/testCase';

// Re-export GroupingMode from sortingService
export type { GroupingMode } from './sortingService';

/**
 * 実行ごとにグルーピングされたデータ
 */
export interface ExecutionGroup {
	execution: Execution;
	cases: TestCase[];
}

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
 * 実行結果を実行ごとにグルーピング（純粋関数）
 */
export function groupByExecution(executions: Execution[]): ExecutionGroup[] {
	return executions.map((execution) => ({
		execution,
		cases: execution.cases,
	}));
}

/**
 * 実行結果をSeedごとにグルーピング（純粋関数）
 */
export function groupBySeed(executions: Execution[]): SeedGroup[] {
	const seedMap = new Map<
		number,
		Array<{
			execution: Execution;
			testCase: TestCase;
		}>
	>();

	for (const execution of executions) {
		for (const testCase of execution.cases) {
			const executionList = seedMap.get(testCase.seed) || [];
			executionList.push({
				execution,
				testCase,
			});
			seedMap.set(testCase.seed, executionList);
		}
	}

	const groups: SeedGroup[] = [];
	for (const [seed, executionList] of seedMap.entries()) {
		groups.push({ seed, executions: executionList });
	}

	// Seed順にソート
	groups.sort((a, b) => a.seed - b.seed);

	return groups;
}
