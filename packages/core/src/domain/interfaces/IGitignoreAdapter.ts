/**
 * .gitignore ファイル管理のアダプターインターフェース
 */
export interface IGitignoreAdapter {
  /**
   * .gitignore のパスを取得
   */
  getGitignorePath(): string;

  /**
   * .gitignore にエントリを追加（重複チェック付き）
   * @param entry 追加するエントリ（例: ".pahcer-ui/"）
   */
  addEntry(entry: string): Promise<void>;
}
