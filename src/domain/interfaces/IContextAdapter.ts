import type { PahcerStatus } from '../models/pahcerStatus';
import type { GroupingMode } from '../services/sortingService';

/**
 * VSCode Context API を型安全に扱うアダプターインターフェース
 *
 * Context の設定・取得を集約し、型安全性と一元管理を提供
 */
export interface IContextAdapter {
  /**
   * pahcer のステータスを設定
   */
  setPahcerStatus(status: PahcerStatus): Promise<void>;

  /**
   * 初期化ビューの表示状態を設定
   */
  setShowInitialization(show: boolean): Promise<void>;

  /**
   * 実行オプションビューの表示状態を設定
   */
  setShowRunOptions(show: boolean): Promise<void>;

  /**
   * グルーピングモードを設定
   */
  setGroupingMode(mode: GroupingMode): Promise<void>;

  /**
   * 差分表示コマンドの有効/無効を設定
   */
  setCanShowDiff(canShow: boolean): Promise<void>;
}
