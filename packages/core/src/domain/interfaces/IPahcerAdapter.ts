import type { PahcerConfig } from '../models/configFile';
import type { PahcerRunOptions, PahcerStatus } from '../models/pahcerStatus';

/**
 * pahcer CLI ツールの実行と状態をチェックするアダプターインターフェース
 */
export interface IPahcerAdapter {
  /**
   * pahcer のインストール・初期化状態を確認
   */
  checkStatus(): Promise<PahcerStatus>;

  /**
   * pahcer run コマンドを実行
   * @param options 実行オプション（startSeed, endSeed, freezeBestScores）
   * @param configFile 設定ファイル（指定時はこちらを使用）
   */
  run(options?: PahcerRunOptions, configFile?: PahcerConfig): Promise<number | undefined>;

  /**
   * pahcer init を実行
   * @param problemName 問題名
   * @param objective 最大化/最小化
   * @param language 言語
   * @param isInteractive インタラクティブモード
   */
  init(
    problemName: string,
    objective: 'max' | 'min',
    language: 'rust' | 'cpp' | 'python' | 'go',
    isInteractive: boolean,
  ): Promise<number | undefined>;
}
