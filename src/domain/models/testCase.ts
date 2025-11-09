/**
 * テストケースのドメインモデル（集約ルート）
 * executionId と seed の複合キーで識別
 * 実行結果のデータと解析データを包含
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
	/** 入力ファイルの1行目（feature抽出用） */
	firstInputLine?: string;
	/** 標準エラー出力から抽出した変数 */
	stderrVars?: Record<string, number>;
}
