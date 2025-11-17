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
export interface PahcerRunOptions {
  startSeed?: number;
  endSeed?: number;
  freezeBestScores?: boolean;
}
