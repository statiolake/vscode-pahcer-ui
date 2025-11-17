import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IGitignoreAdapter } from '../domain/interfaces/IGitignoreAdapter';

/**
 * .gitignoreファイルを管理するアダプター
 *
 * インフラ層の責務:
 * - .gitignoreの読み書き
 * - エントリの追加
 */
export class GitignoreAdapter implements IGitignoreAdapter {
  constructor(private workspaceRoot: string) {}

  /**
   * .gitignoreのパスを取得
   */
  getGitignorePath(): string {
    return path.join(this.workspaceRoot, '.gitignore');
  }

  /**
   * .gitignoreにエントリを追加（重複チェック付き）
   *
   * @param entry - 追加するエントリ（例: "tools/target"）
   */
  addEntry(entry: string): void {
    try {
      const gitignorePath = this.getGitignorePath();
      let content = '';

      // Read existing .gitignore if it exists
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf8');
      }

      // Check if entry already exists
      if (!content.includes(entry)) {
        const newLine = content.endsWith('\n') || content === '' ? '' : '\n';
        content += `${newLine}${entry}\n`;
        fs.writeFileSync(gitignorePath, content, 'utf8');
      }
    } catch (error) {
      console.error('Failed to update .gitignore:', error);
      throw error;
    }
  }
}
