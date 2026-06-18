import type { ConfigId, PahcerConfig } from '../models/configFile';

/**
 * pahcer 設定ファイル（pahcer_config.toml）リポジトリインターフェース
 *
 * 責務:
 * - TOML ファイルの読み込み/書き込み
 * - TOML コンテンツから start_seed, end_seed, objective をパース
 * - PahcerConfig ドメインモデルへの変換
 */
export interface IPahcerConfigRepository {
  /**
   * 指定されたファイルを読み込み、PahcerConfig に変換
   * temporary の場合、通常ファイルから一時ファイルを作成してコピー
   *
   * ファイルが見つからない場合（ENOENT）は undefined を返す
   * その他の例外は投げ直す
   */
  findById(id: ConfigId): Promise<PahcerConfig | undefined>;

  /**
   * PahcerConfig をファイルに保存
   * config.path に指定されているパスに保存
   */
  upsert(config: PahcerConfig): Promise<void>;

  /**
   * 指定された id のファイルを削除
   * normal ファイルは保護されており削除されない
   * ファイルが見つからない場合（ENOENT）は無視される
   * その他の例外は投げ直される
   */
  delete(id: ConfigId): Promise<void>;
}
