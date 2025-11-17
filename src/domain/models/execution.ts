import type { Dayjs } from 'dayjs';

/**
 * テスト実行のエンティティ（メタデータのみ）
 * 実行ごとの集計情報は ExecutionAggregationService で計算
 */
export class Execution {
  private _comment: string;

  /**
   * Execution エンティティを構築する
   * @param id 実行ID - 不変
   * @param startTime 開始時刻 - 不変
   * @param comment コメント - 可変
   * @param tagName タグ名 - 不変
   * @param commitHash コミットハッシュ - 可変（オプション）
   */
  constructor(
    public readonly id: string,
    public readonly startTime: Dayjs,
    comment: string,
    public readonly tagName: string | null,
    public commitHash?: string,
  ) {
    if (!id || id.trim() === '') {
      throw new Error('Execution id must not be empty');
    }
    this._comment = comment;
  }

  /**
   * コメントを取得する
   */
  get comment(): string {
    return this._comment;
  }

  /**
   * コメントを設定する
   */
  set comment(value: string) {
    this._comment = value;
  }

  /**
   * 実行結果の短いタイトル（MM/DD HH:MM）
   */
  getShortTitle(): string {
    return this.startTime.format('MM/DD HH:mm');
  }

  /**
   * 実行結果の長いタイトル（YYYY/MM/DD HH:MM:SS）
   */
  getLongTitle(): string {
    return this.startTime.format('YYYY/MM/DD HH:mm:ss');
  }

  /**
   * 実行結果のコミットハッシュ付きタイトル（MM/DD HH:MM@hash）
   */
  getTitleWithHash(): string {
    if (!this.commitHash) {
      return this.getShortTitle();
    }
    const shortTitle = this.getShortTitle();
    const shortHash = this.commitHash.slice(0, 7);
    return `${shortTitle}@${shortHash}`;
  }
}
