import * as vscode from 'vscode';
import type { IExecutionRepository } from '../../../domain/interfaces/IExecutionRepository';
import type { IGitAdapter } from '../../../domain/interfaces/IGitAdapter';
import type { PahcerTreeItem } from '../pahcerTreeViewController';

/**
 * 選択した実行時点でのソースコードをクリップボードにコピーするコマンド
 */
export function copySourceCommand(
  executionRepository: IExecutionRepository,
  gitAdapter: IGitAdapter,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    try {
      if (!item.executionId) {
        return;
      }

      // 実行情報を取得
      const execution = await executionRepository.findById(item.executionId);
      if (!execution) {
        vscode.window.showErrorMessage('実行情報が見つかりません');
        return;
      }

      // コミットハッシュがない場合
      if (!execution.commitHash) {
        vscode.window.showErrorMessage(
          'この実行にはコミットハッシュが記録されていません。Git統合が有効な状態で実行されたテストのみコピーできます。',
        );
        return;
      }

      // そのコミット時点でのソースファイル一覧を取得
      const files = await gitAdapter.getSourceFilesAtCommit(execution.commitHash);

      if (files.length === 0) {
        vscode.window.showInformationMessage('コピー対象のソースファイルが見つかりませんでした');
        return;
      }

      let selectedFile: string;

      if (files.length === 1) {
        // ファイルが1つだけの場合はそのまま使用
        selectedFile = files[0];
      } else {
        // 複数ファイルの場合は QuickPick で選択
        const picked = await vscode.window.showQuickPick(
          files.map((f) => ({
            label: f,
            description: '',
          })),
          {
            placeHolder: 'コピーするファイルを選択してください',
            title: 'ソースファイルを選択',
          },
        );

        if (!picked) {
          // キャンセルされた
          return;
        }

        selectedFile = picked.label;
      }

      // ファイル内容を取得
      const content = await gitAdapter.getFileContentAtCommit(execution.commitHash, selectedFile);

      // クリップボードにコピー
      await vscode.env.clipboard.writeText(content);

      vscode.window.showInformationMessage(`${selectedFile} をクリップボードにコピーしました`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `ソースコードのコピーに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
