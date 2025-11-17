import { execSync } from 'node:child_process';
import * as vscode from 'vscode';
import { CommandExecutionError } from './exceptions';

/**
 * 差分を開くとき、最大で開くファイルの数
 */
const MAX_FILES = 3;

/**
 * Git操作を抽象化するアダプター
 */
export class GitAdapter {
  constructor(private workspaceRoot: string) {}

  /**
   * pahcer実行後に結果ファイルをコミット（output + results + meta.json）
   * @param workspaceRoot ワークスペースルート
   * @param caseCount テストケース数
   * @param totalScore 総スコア
   */
  async commitResultsAfterExecution(caseCount: number, totalScore: number): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('pahcer-ui');
    const gitIntegration = config.get<boolean>('gitIntegration');

    // Git統合が無効な場合は何もしない
    if (gitIntegration !== true) {
      return null;
    }

    try {
      const now = new Date();

      // Format as local time ISO format (YYYY-MM-DDTHH:mm:ss)
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

      // 平均スコアを計算
      const averageScore = caseCount > 0 ? totalScore / caseCount : 0;

      // コミットメッセージを作成
      const message = `Results at ${timestamp} - ${caseCount} cases, total score: ${totalScore}, avg: ${averageScore.toFixed(2)}`;

      const commitHash = await this.commitAll(message);

      vscode.window.showInformationMessage(`結果コミット作成: ${commitHash.slice(0, 7)}`);
      return commitHash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`結果コミット作成に失敗しました: ${errorMessage}`);
      return null;
    }
  }

  /**
   * pahcer実行前にソースコードをコミット
   */
  async commitSourceBeforeExecution(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('pahcer-ui');
    let gitIntegration = config.get<boolean | null>('gitIntegration');

    // 初回（未設定）の場合はダイアログを表示
    if (gitIntegration === null) {
      // Gitリポジトリでない場合は無効化
      if (!this.isGitRepository()) {
        return null;
      }

      const result = await vscode.window.showWarningMessage(
        'Pahcer UIでGit統合を有効にしますか？',
        {
          modal: true,
          detail:
            '有効にすると、テスト実行前に自動的にコミットを作成し、後でバージョン間の差分を確認できます。\n\n' +
            '⚠️ 注意: ワークスペース内のすべての変更ファイルが自動的にコミットされます。' +
            '.gitignoreを注意深く確認し、コミットしたくないファイルが除外されていることを確認してください。',
        },
        { title: '有効にする' },
        { title: '無効にする', isCloseAffordance: true },
      );

      if (result !== undefined && result.title === '有効にする') {
        await config.update('gitIntegration', true, vscode.ConfigurationTarget.Workspace);
        gitIntegration = true;
      } else {
        await config.update('gitIntegration', false, vscode.ConfigurationTarget.Workspace);
        gitIntegration = false;
      }
    }

    // Git統合が有効な場合はコミット
    if (gitIntegration === true) {
      const now = new Date();
      // Format as local time ISO format (YYYY-MM-DDTHH:mm:ss)
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      const commitHash = await this.commitAll(`Run at ${timestamp}`);

      vscode.window.showInformationMessage(`コミット作成: ${commitHash.slice(0, 7)}`);
      return commitHash;
    }

    return null;
  }

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
}
