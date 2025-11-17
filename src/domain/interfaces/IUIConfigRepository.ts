import type { UIConfig } from '../models/uiConfig';

/**
 * 比較設定のリポジトリインターフェース
 */
export interface IUIConfigRepository {
  /**
   * 設定を読み込む
   * ファイルが見つからない場合はデフォルト設定を返す
   * その他のエラーは投げ直す
   */
  find(): Promise<UIConfig>;

  /**
   * 設定を保存する
   */
  upsert(config: UIConfig): Promise<void>;
}
