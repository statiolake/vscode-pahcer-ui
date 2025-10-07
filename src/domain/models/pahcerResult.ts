import type { TestCase } from './testCase';

/**
 * Pahcer実行結果のドメインモデル
 */
export interface PahcerResult {
	startTime: string;
	caseCount: number;
	totalScore: number;
	totalScoreLog10: number;
	totalRelativeScore: number;
	maxExecutionTime: number;
	comment: string;
	tagName: string | null;
	waSeeds: number[];
	cases: TestCase[];
}

/**
 * 実行結果のIDを含む実行結果
 */
export interface PahcerResultWithId {
	id: string;
	result: PahcerResult;
}
