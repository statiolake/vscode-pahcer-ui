/**
 * テストケースのドメインモデル（集約ルート）
 * executionId と seed の複合キーで識別
 */
export interface TestCase {
	/** 実行ID */
	executionId: string;
	/** Seed番号 */
	seed: number;
	/** スコア（0以下の場合は WA） */
	score: number;
	/** 実行時間（秒） */
	executionTime: number;
	/** エラーメッセージ */
	errorMessage: string;
	/** 出力ファイルが見つかったかどうか */
	foundOutput: boolean;
}
