/**
 * ビジュアライザのダウンロードと管理を行うアダプターインターフェース
 */
export interface IVisualizerDownloader {
  /**
   * ビジュアライザをダウンロード
   * @param url ビジュアライザのURL
   * @returns ダウンロードされたHTMLファイル名
   */
  download(url: string): Promise<string>;
}
