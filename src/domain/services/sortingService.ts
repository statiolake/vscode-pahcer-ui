import type { PahcerResult } from '../models/pahcerResult';
import type { TestCase } from '../models/testCase';

/**
 * グルーピングモード
 */
export type GroupingMode = 'byExecution' | 'bySeed';

/**
 * ソート順の型定義
 */
export type ExecutionSortOrder =
	| 'seedAsc'
	| 'seedDesc'
	| 'relativeScoreAsc'
	| 'relativeScoreDesc'
	| 'absoluteScoreAsc'
	| 'absoluteScoreDesc';

export type SeedSortOrder =
	| 'executionAsc'
	| 'executionDesc'
	| 'absoluteScoreAsc'
	| 'absoluteScoreDesc';

/**
 * テストケースをソートする（純粋関数）
 */
export function sortTestCases(cases: TestCase[], order: ExecutionSortOrder): TestCase[] {
	const sorted = [...cases];

	switch (order) {
		case 'seedAsc':
			sorted.sort((a, b) => a.seed - b.seed);
			break;
		case 'seedDesc':
			sorted.sort((a, b) => b.seed - a.seed);
			break;
		case 'relativeScoreAsc':
			sorted.sort((a, b) => a.relativeScore - b.relativeScore);
			break;
		case 'relativeScoreDesc':
			sorted.sort((a, b) => b.relativeScore - a.relativeScore);
			break;
		case 'absoluteScoreAsc':
			sorted.sort((a, b) => a.score - b.score);
			break;
		case 'absoluteScoreDesc':
			sorted.sort((a, b) => b.score - a.score);
			break;
	}

	return sorted;
}

/**
 * Seed別の実行結果をソートする（純粋関数）
 */
export function sortExecutionsForSeed<T extends { file: string; testCase: TestCase }>(
	executions: T[],
	order: SeedSortOrder,
): T[] {
	const sorted = [...executions];

	switch (order) {
		case 'executionAsc':
			sorted.sort((a, b) => a.file.localeCompare(b.file));
			break;
		case 'executionDesc':
			sorted.sort((a, b) => b.file.localeCompare(a.file));
			break;
		case 'absoluteScoreAsc':
			sorted.sort((a, b) => a.testCase.score - b.testCase.score);
			break;
		case 'absoluteScoreDesc':
			sorted.sort((a, b) => b.testCase.score - a.testCase.score);
			break;
	}

	return sorted;
}
