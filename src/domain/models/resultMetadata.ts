/**
 * seed別の解析結果
 */
export interface SeedAnalysis {
	/** 入力ファイルの1行目（feature抽出用） */
	firstInputLine: string;
	/** 標準エラー出力から抽出した変数 */
	stderrVars: Record<string, number>;
}

/**
 * 実行結果のメタデータ
 */
export interface ResultMetadata {
	commitHash?: string;
	/** seed別の解析結果（キャッシュ） */
	analysis?: Record<number, SeedAnalysis>;
}
