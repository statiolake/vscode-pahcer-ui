/**
 * テスト実行のエンティティ（メタデータのみ）
 * 実行ごとの集計情報は ExecutionAggregationService で計算
 */
export interface Execution {
	/** 実行ID（例: "20250111_123456"） */
	id: string;
	/** 開始時刻 */
	startTime: string;
	/** コメント */
	comment: string;
	/** タグ名 */
	tagName: string | null;
	/** コミットハッシュ */
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
