import type { TestCase } from './testCase';

/**
 * テスト実行のエンティティ
 * 各テスト実行を一意に識別するIDを持つ
 */
export interface Execution {
	/** 実行ID（例: "20250111_123456"） */
	id: string;
	startTime: string;
	caseCount: number;
	totalScore: number;
	totalScoreLog10: number;
	maxExecutionTime: number;
	comment: string;
	tagName: string | null;
	waSeeds: number[];
	cases: TestCase[];
	commitHash?: string;
}

/**
 * 実行結果の短いタイトル（MM/DD HH:MM）
 */
export function getShortTitle(execution: Execution): string {
	const date = new Date(execution.startTime);
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${month}/${day} ${hour}:${minute}`;
}

/**
 * 実行結果の長いタイトル（YYYY/MM/DD HH:MM:SS）
 */
export function getLongTitle(execution: Execution): string {
	const date = new Date(execution.startTime);
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
export function getTitleWithHash(execution: Execution): string {
	if (!execution.commitHash) {
		return getShortTitle(execution);
	}
	const shortTitle = getShortTitle(execution);
	const shortHash = execution.commitHash.slice(0, 7);
	return `${shortTitle}@${shortHash}`;
}

/**
 * AC数を計算する
 */
export function getAcCount(execution: Execution): number {
	return execution.caseCount - execution.waSeeds.length;
}

/**
 * 平均スコアを計算する
 */
export function getAverageScore(execution: Execution): number {
	return execution.caseCount > 0 ? execution.totalScore / execution.caseCount : 0;
}

/**
 * 平均相対スコアを計算する
 */
export function getAverageRelativeScore(execution: Execution): number {
	if (execution.caseCount === 0) {
		return 0;
	}
	const totalRelativeScore = execution.cases.reduce((sum, c) => sum + c.relativeScore, 0);
	return totalRelativeScore / execution.caseCount;
}
