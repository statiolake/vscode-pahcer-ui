/**
 * Git 操作を抽象化するアダプターインターフェース
 *
 * Git コマンドの実行と差分表示を統一的に提供
 */
export interface IGitAdapter {
  /**
   * pahcer 実行前にソースコードをコミット
   * @returns コミットハッシュ、またはコミット不可の場合は null
   */
  commitSourceBeforeExecution(): Promise<string | null>;

  /**
   * pahcer 実行後に結果ファイルをコミット
   * @param caseCount テストケース数
   * @param totalScore 総スコア
   * @returns コミットハッシュ、またはコミット不可の場合は null
   */
  commitResultsAfterExecution(caseCount: number, totalScore: number): Promise<string | null>;

  /**
   * すべての変更をステージングしてコミット
   * @param message コミットメッセージ
   * @returns コミットハッシュ
   */
  commitAll(message: string): Promise<string>;

  /**
   * 指定した 2 つのコミット間の差分を VS Code で表示
   * @param olderCommitHash 古いコミットハッシュ
   * @param newerCommitHash 新しいコミットハッシュ
   * @param leftTitle 左側のタイトル
   * @param rightTitle 右側のタイトル
   */
  showDiff(
    olderCommitHash: string,
    newerCommitHash: string,
    leftTitle: string,
    rightTitle: string,
  ): Promise<void>;

  /**
   * Git リポジトリが存在するかチェック
   */
  isGitRepository(): boolean;
}
