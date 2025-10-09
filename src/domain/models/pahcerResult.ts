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
	commitHash?: string;
}

/**
 * 実行結果のIDを含む実行結果
 */
export interface PahcerResultWithId {
	id: string;
	result: PahcerResult;
}

/**
 * 実行結果の短いタイトル（MM/DD HH:MM）
 */
export function getShortTitle(result: PahcerResult): string {
	const date = new Date(result.startTime);
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${month}/${day} ${hour}:${minute}`;
}

/**
 * 実行結果の長いタイトル（YYYY/MM/DD HH:MM:SS）
 */
export function getLongTitle(result: PahcerResult): string {
	const date = new Date(result.startTime);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}

/**
 * 実行結果のコミットハッシュ付きタイトル（MM/DD HH:MM@hash）
 */
export function getTitleWithHash(result: PahcerResult): string {
	if (!result.commitHash) {
		return getShortTitle(result);
	}
	const shortTitle = getShortTitle(result);
	const shortHash = result.commitHash.slice(0, 7);
	return `${shortTitle}@${shortHash}`;
}

/**
 * AC数を計算する
 */
export function getAcCount(result: PahcerResult): number {
	return result.caseCount - result.waSeeds.length;
}

/**
 * 平均スコアを計算する
 */
export function getAverageScore(result: PahcerResult): number {
	return result.caseCount > 0 ? result.totalScore / result.caseCount : 0;
}

/**
 * 平均相対スコアを計算する
 */
export function getAverageRelativeScore(result: PahcerResult): number {
	return result.caseCount > 0 ? result.totalRelativeScore / result.caseCount : 0;
}
