import { execSync } from 'node:child_process';
import * as vscode from 'vscode';
import type { IGitAdapter } from '../domain/interfaces/IGitAdapter';
import { CommandExecutionError } from './exceptions';

/**
 * 差分を開くとき、最大で開くファイルの数
 */
const MAX_FILES = 3;

/**
 * Git操作を抽象化するアダプター
 *
 * 責務: 純粋な Git 操作のみ
 * - git add/commit
 * - git diff 表示
 * - リポジトリ判定
 *
 * ユースケースロジック（設定判定、メッセージ表示）は CommitResultsUseCase に移譲
 */
export class GitAdapter implements IGitAdapter {
  constructor(private workspaceRoot: string) {}

  /**
   * 全ての変更をステージングしてコミットし、コミットハッシュを返す
   * 変更がない場合は現在のHEADのコミットハッシュを返す
   */
  async commitAll(message: string): Promise<string> {
    try {
      // git add . (only workspace directory)
      execSync('git add .', { cwd: this.workspaceRoot });

      // Check if there are changes to commit
      try {
        execSync('git diff-index --quiet HEAD', { cwd: this.workspaceRoot });
        // No changes - return current HEAD
        const hash = execSync('git rev-parse HEAD', { cwd: this.workspaceRoot }).toString().trim();
        return hash;
      } catch {
        // There are changes - proceed with commit
        execSync(`git commit -m "${message}"`, { cwd: this.workspaceRoot });

        // Get commit hash
        const hash = execSync('git rev-parse HEAD', { cwd: this.workspaceRoot }).toString().trim();

        return hash;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError('git commit', message);
    }
  }

  /**
   * 指定した2つのコミット間の差分をVS Codeで表示
   * @param olderCommitHash 古い方のコミットハッシュ (left)
   * @param newerCommitHash 新しい方のコミットハッシュ (right)
   * @param leftTitle 左側（古い方）のタイトル
   * @param rightTitle 右側（新しい方）のタイトル
   */
  async showDiff(
    olderCommitHash: string,
    newerCommitHash: string,
    leftTitle: string,
    rightTitle: string,
  ): Promise<void> {
    try {
      // Get list of changed files with numstat to detect binary files
      const numstatOutput = execSync(`git diff --numstat ${olderCommitHash} ${newerCommitHash}`, {
        cwd: this.workspaceRoot,
      })
        .toString()
        .trim();

      if (!numstatOutput) {
        vscode.window.showInformationMessage('変更されたファイルはありません');
        return;
      }

      // Parse numstat output: "added deleted filename" or "- - filename" for binary
      const files = numstatOutput
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('\t');
          return {
            isBinary: parts[0] === '-' && parts[1] === '-',
            filename: parts[2],
          };
        })
        .filter((f) => !f.isBinary) // Exclude binary files
        .map((f) => f.filename)
        .filter((f) => {
          // Filter out files in tools/ directory
          if (f.startsWith('tools/')) {
            return false;
          }
          // Filter out files in directories starting with . (like .vscode/, .pahcer-ui/)
          const pathParts = f.split('/');
          for (const part of pathParts) {
            if (part.startsWith('.')) {
              return false;
            }
          }
          // Filter out .txt, .json, and .html files
          const ext = f.toLowerCase().split('.').pop();
          return ext !== 'txt' && ext !== 'json' && ext !== 'html';
        });

      if (files.length === 0) {
        vscode.window.showInformationMessage('表示対象の変更ファイルはありません');
        return;
      }

      if (files.length > MAX_FILES) {
        vscode.window.showErrorMessage(
          `変更ファイルが多すぎます（${files.length}個）。差分表示は${MAX_FILES}個以下のファイルでのみ利用できます。`,
        );
        return;
      }

      // Open diff for each file
      for (const file of files) {
        const fileUri = vscode.Uri.file(`${this.workspaceRoot}/${file}`);
        const leftUri = fileUri.with({
          scheme: 'git',
          query: JSON.stringify({ ref: olderCommitHash, path: fileUri.fsPath }),
        });
        const rightUri = fileUri.with({
          scheme: 'git',
          query: JSON.stringify({ ref: newerCommitHash, path: fileUri.fsPath }),
        });

        await vscode.commands.executeCommand(
          'vscode.diff',
          leftUri,
          rightUri,
          `${file} (${leftTitle} ↔ ${rightTitle})`,
          { preview: false }, // Open in regular tab, not preview tab
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError('git diff', message);
    }
  }

  /**
   * Gitリポジトリが存在するかチェック
   */
  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 指定したコミットでのソースファイル一覧を取得
   * showDiff と同じフィルタリングを適用
   */
  async getSourceFilesAtCommit(commitHash: string): Promise<string[]> {
    try {
      // Get list of files at the commit
      const output = execSync(`git ls-tree -r --name-only ${commitHash}`, {
        cwd: this.workspaceRoot,
      })
        .toString()
        .trim();

      if (!output) {
        return [];
      }

      return output
        .split('\n')
        .filter((line) => line.trim())
        .filter((f) => {
          // Filter out files in tools/ directory
          if (f.startsWith('tools/')) {
            return false;
          }
          // Filter out files in directories starting with . (like .vscode/, .pahcer-ui/)
          const pathParts = f.split('/');
          for (const part of pathParts) {
            if (part.startsWith('.')) {
              return false;
            }
          }
          // Filter out .txt, .json, and .html files
          const ext = f.toLowerCase().split('.').pop();
          return ext !== 'txt' && ext !== 'json' && ext !== 'html';
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError('git ls-tree', message);
    }
  }

  /**
   * 指定したコミット時点でのファイル内容を取得
   */
  async getFileContentAtCommit(commitHash: string, filePath: string): Promise<string> {
    try {
      const content = execSync(`git show ${commitHash}:${filePath}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      });
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError('git show', message);
    }
  }
}
