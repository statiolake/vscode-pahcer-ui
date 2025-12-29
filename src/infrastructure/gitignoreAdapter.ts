import { promises as fs } from 'node:fs';
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
  async addEntry(entry: string): Promise<void> {
    try {
      const gitignorePath = this.getGitignorePath();
      let content = '';

      // Read existing .gitignore if it exists
      try {
        content = await fs.readFile(gitignorePath, 'utf8');
      } catch {
        // File doesn't exist, start with empty content
      }

      // Check if entry already exists
      if (!content.includes(entry)) {
        const newLine = content.endsWith('\n') || content === '' ? '' : '\n';
        content += `${newLine}${entry}\n`;
        await fs.writeFile(gitignorePath, content, 'utf8');
      }
    } catch (error) {
      console.error('Failed to update .gitignore:', error);
      throw error;
    }
  }
}
