/**
 * ファイル解析の抽象化インターフェース
 *
 * 責務:
 * - ファイルの読み込みと解析処理を抽象化
 * - ストリーミング処理で大きなファイルにも対応
 * - パースロジック（stderr変数抽出など）をサポート
 */
export interface IFileAnalyzer {
  /**
   * ファイルの1行目だけを読み込む
   */
  readFirstLine(filePath: string): Promise<string>;

  /**
   * ファイルの先頭N行と末尾N行を読み込む
   */
  readHeadAndTail(
    filePath: string,
    headLines?: number,
    tailLines?: number,
  ): Promise<{ head: string; tail: string }>;

  /**
   * 複数のファイルの1行目を並列読み込み
   */
  readFirstLinesParallel(filePaths: string[]): Promise<Map<string, string>>;

  /**
   * 複数のファイルの先頭・末尾を並列読み込み
   */
  readHeadAndTailParallel(
    filePaths: string[],
    headLines?: number,
    tailLines?: number,
  ): Promise<Map<string, { head: string; tail: string }>>;

  /**
   * stderrファイルから変数を抽出（$varname = value）
   */
  parseStderrVariables(
    filePath: string,
    headLines?: number,
    tailLines?: number,
  ): Promise<Record<string, number>>;

  /**
   * 複数のstderrファイルから変数を並列抽出
   */
  parseStderrVariablesParallel(
    filePaths: string[],
    headLines?: number,
    tailLines?: number,
  ): Promise<Map<string, Record<string, number>>>;
}
