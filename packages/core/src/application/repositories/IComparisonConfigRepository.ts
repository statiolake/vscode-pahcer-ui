import type { ComparisonConfig } from '../dtos/comparisonConfig';

/**
 * 比較ビュー設定の永続化 port。
 */
export interface IComparisonConfigRepository {
  /**
   * 設定を読み込む。
   * ファイルが見つからない場合はデフォルト設定を返す。
   */
  find(): Promise<ComparisonConfig>;

  /**
   * 設定を保存する。
   */
  upsert(config: ComparisonConfig): Promise<void>;
}
