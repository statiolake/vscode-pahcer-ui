import type { Dayjs } from 'dayjs';

/**
 * テスト実行のエンティティ（メタデータのみ）
 * 実行ごとの集計情報は ExecutionAggregationService で計算
 */
export interface Execution {
  /** 実行ID（例: "20250111_123456"） */
  id: string;
  /** 開始時刻 */
  startTime: Dayjs;
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
  return execution.startTime.format('MM/DD HH:mm');
}

/**
 * 実行結果の長いタイトル（YYYY/MM/DD HH:MM:SS）
 */
export function getLongTitle(execution: Execution): string {
  return execution.startTime.format('YYYY/MM/DD HH:mm:ss');
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
