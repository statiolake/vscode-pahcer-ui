/**
 * ビジュアライザのキャッシュ管理インターフェース
 */
export interface IVisualizerCache {
  /**
   * キャッシュされたHTMLファイル名を取得
   */
  getCachedHtmlFileName(): string | null;

  /**
   * HTMLファイルのパスを取得
   */
  getHtmlPath(fileName: string): string;

  /**
   * HTMLファイルが存在するかチェック
   */
  exists(fileName: string): boolean;

  /**
   * HTMLファイルを読み込む
   */
  readHtml(fileName: string): string;

  /**
   * リソースファイルのパスを取得
   */
  getResourcePath(fileName: string): string;

  /**
   * リソースファイルが存在するかチェック
   */
  resourceExists(fileName: string): boolean;

  /**
   * ビジュアライザディレクトリのパスを取得
   */
  getVisualizerDir(): string;
}
