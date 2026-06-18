/**
 * Git 操作を抽象化するアダプターインターフェース
 *
 * 責務: 純粋な Git 操作のみ
 * - git add/commit
 * - git diff 表示
 * - リポジトリ判定
 *
 * ユースケースロジック（設定判定、メッセージ表示）は提供しません。
 * これらは CommitResultsUseCase で処理されます。
 */
export interface IGitAdapter {
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

  /**
   * 指定したコミットでのソースファイル一覧を取得
   * （tools/ や dotfile ディレクトリ、.txt/.json/.html ファイルは除外）
   * @param commitHash コミットハッシュ
   * @returns ソースファイルのパス一覧
   */
  getSourceFilesAtCommit(commitHash: string): Promise<string[]>;

  /**
   * 指定したコミット時点でのファイル内容を取得
   * @param commitHash コミットハッシュ
   * @param filePath ファイルパス（リポジトリルートからの相対パス）
   * @returns ファイル内容
   */
  getFileContentAtCommit(commitHash: string, filePath: string): Promise<string>;
}
