/**
 * pahcerのインストール状態
 */
export type PahcerStatus = 'notInstalled' | 'notInitialized' | 'ready';

/**
 * pahcer run のオプション
 */
export class PahcerRunOptions {
  /**
   * PahcerRunOptions を構築する
   * @param startSeed 開始seed（オプション）
   * @param endSeed 終了seed（オプション）
   * @param freezeBestScores ベストスコアを固定するか（オプション）
   */
  constructor(
    public startSeed?: number,
    public endSeed?: number,
    public freezeBestScores?: boolean,
  ) {}
}
