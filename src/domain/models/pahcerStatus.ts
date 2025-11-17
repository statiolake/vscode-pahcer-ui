/**
 * pahcerのインストール状態
 */
export enum PahcerStatus {
  /** pahcerがインストールされていない */
  NotInstalled,
  /** pahcerはインストールされているが初期化されていない */
  NotInitialized,
  /** pahcerがインストールされ初期化済み */
  Ready,
}

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
