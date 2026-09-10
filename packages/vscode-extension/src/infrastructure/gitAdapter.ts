import {
  MAX_DIFF_FILES,
  NodeGitAdapter,
} from '@pahcer/node-adapters/infrastructure/nodeGitAdapter';
import * as vscode from 'vscode';
import { VSCodeCommandExecutionError } from './exceptions';

/**
 * VS Code 向けの Git アダプター
 *
 * 純粋な Git 操作は NodeGitAdapter を継承して共有し、
 * ここでは VS Code 固有の差分表示（vscode.diff）だけを実装する
 *
 * ユースケースロジック（設定判定、メッセージ表示）は CommitResultsUseCase に移譲
 */
export class GitAdapter extends NodeGitAdapter {
  /**
   * 指定した2つのコミット間の差分をVS Codeで表示
   * @param olderCommitHash 古い方のコミットハッシュ (left)
   * @param newerCommitHash 新しい方のコミットハッシュ (right)
   * @param leftTitle 左側（古い方）のタイトル
   * @param rightTitle 右側（新しい方）のタイトル
   */
  override async showDiff(
    olderCommitHash: string,
    newerCommitHash: string,
    leftTitle: string,
    rightTitle: string,
  ): Promise<void> {
    let files: string[];
    try {
      files = await this.listChangedSourceFiles(olderCommitHash, newerCommitHash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VSCodeCommandExecutionError('git diff', message);
    }

    if (files.length === 0) {
      vscode.window.showInformationMessage('表示対象の変更ファイルはありません');
      return;
    }

    if (files.length > MAX_DIFF_FILES) {
      vscode.window.showErrorMessage(
        `変更ファイルが多すぎます（${files.length}個）。差分表示は${MAX_DIFF_FILES}個以下のファイルでのみ利用できます。`,
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
  }
}
