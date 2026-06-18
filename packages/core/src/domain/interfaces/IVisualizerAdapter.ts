/**
 * ビジュアライザのキャッシュ管理とダウンロードを行うアダプターインターフェース
 *
 * 責務:
 * - ビジュアライザファイルのダウンロード
 * - キャッシュされたファイルの読み込み・存在確認
 * - リソースパスの管理
 */
export interface IVisualizerAdapter {
  /**
   * キャッシュされたHTMLファイル名を取得
   * @returns HTMLファイル名、存在しない場合は null
   */
  getCachedHtmlFileName(): Promise<string | null>;

  /**
   * ビジュアライザをダウンロード
   * @param url ビジュアライザのURL
   * @returns ダウンロードされたHTMLファイル名
   */
  download(url: string): Promise<string>;

  /**
   * HTMLファイルのパスを取得
   */
  getHtmlPath(fileName: string): string;

  /**
   * HTMLファイルを読み込む
   */
  readHtml(fileName: string): Promise<string>;

  /**
   * リソースファイルのパスを取得
   */
  getResourcePath(fileName: string): string;

  /**
   * リソースファイルが存在するかチェック
   */
  resourceExists(fileName: string): Promise<boolean>;

  /**
   * ビジュアライザディレクトリのパスを取得
   */
  getVisualizerDir(): string;
}
