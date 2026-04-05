import type { PahcerStatus } from '../models/pahcerStatus';
import type { InitPahcerCommand, PahcerJob, RunPahcerCommand } from './pahcerJob';

/**
 * pahcer CLI ツールの実行と状態確認を抽象化するポート
 */
export interface IPahcerAdapter {
  /**
   * pahcer のインストール・初期化状態を確認
   */
  checkStatus(): Promise<PahcerStatus>;

  /**
   * pahcer init を開始する
   */
  startInit(command: InitPahcerCommand): Promise<PahcerJob>;

  /**
   * pahcer run を開始する
   */
  startRun(command: RunPahcerCommand): Promise<PahcerJob>;
}
