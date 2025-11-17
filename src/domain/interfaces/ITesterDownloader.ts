/**
 * テスターのダウンロード情報
 */
export interface DownloadedTester {
  /** テスターがインタラクティブ型のテスターかどうか */
  seemsInteractive: boolean;
}

/**
 * テスターのダウンロードと管理を行うアダプターインターフェース
 */
export interface ITesterDownloader {
  /**
   * ZIPファイルをダウンロードして展開
   * @param url ダウンロードURL
   * @returns ダウンロード情報
   */
  downloadAndExtract(url: string): Promise<DownloadedTester>;
}
