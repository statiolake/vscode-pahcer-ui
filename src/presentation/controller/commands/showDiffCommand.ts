import * as vscode from 'vscode';
import type { IGitAdapter } from '../../../domain/interfaces/IGitAdapter';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

const MAX_FILES = 3;

/**
 * チェックされた2つの結果の差分を表示
 */
export function showDiffCommand(
  treeViewController: PahcerTreeViewController,
  gitAdapter: IGitAdapter,
): () => Promise<void> {
  return async () => {
    const checkedExecutions = await treeViewController.getCheckedResultsWithCommitHash();

    if (checkedExecutions.length !== 2) {
      vscode.window.showErrorMessage('コミットハッシュを持つ実行結果を2つ選択してください');
      return;
    }

    // Sort by startTime to ensure older is left, newer is right
    const sorted = checkedExecutions.sort((a, b) => a.startTime.valueOf() - b.startTime.valueOf());

    const [older, newer] = sorted;

    if (!older.commitHash || !newer.commitHash) {
      vscode.window.showErrorMessage('選択された結果にコミットハッシュがありません');
      return;
    }

    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('ワークスペースが開かれていません');
        return;
      }
      const files = await gitAdapter.getChangedSourceFilesBetweenCommits(
        older.commitHash,
        newer.commitHash,
      );
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

      for (const file of files) {
        const fileUri = vscode.Uri.file(`${workspaceRoot}/${file}`);
        const leftUri = fileUri.with({
          scheme: 'git',
          query: JSON.stringify({ ref: older.commitHash, path: fileUri.fsPath }),
        });
        const rightUri = fileUri.with({
          scheme: 'git',
          query: JSON.stringify({ ref: newer.commitHash, path: fileUri.fsPath }),
        });

        await vscode.commands.executeCommand(
          'vscode.diff',
          leftUri,
          rightUri,
          `${file} (${older.getTitleWithHash()} ↔ ${newer.getTitleWithHash()})`,
          { preview: false },
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`差分表示に失敗しました: ${error}`);
    }
  };
}
