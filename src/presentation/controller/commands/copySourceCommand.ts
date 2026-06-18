import * as vscode from 'vscode';
import type { CopySourceAtExecutionUseCase } from '../../../application/copySourceAtExecutionUseCase';
import type { PahcerTreeItem } from '../pahcerTreeViewController';

/**
 * 選択した実行時点でのソースコードをクリップボードにコピーするコマンド
 */
export function copySourceCommand(
  copySourceAtExecutionUseCase: CopySourceAtExecutionUseCase,
): (item: PahcerTreeItem) => Promise<void> {
  return async (item: PahcerTreeItem) => {
    try {
      if (!item.executionId) {
        return;
      }

      const preparation = await copySourceAtExecutionUseCase.prepare(item.executionId);

      let selectedFile: string;

      switch (preparation.status) {
        case 'notFound':
          vscode.window.showErrorMessage('実行情報が見つかりません');
          return;
        case 'missingCommitHash':
          vscode.window.showErrorMessage(
            'この実行にはコミットハッシュが記録されていません。Git統合が有効な状態で実行されたテストのみコピーできます。',
          );
          return;
        case 'noFiles':
          vscode.window.showInformationMessage('コピー対象のソースファイルが見つかりませんでした');
          return;
        case 'ready':
          break;
      }

      if (preparation.files.length === 1) {
        // ファイルが1つだけの場合はそのまま使用
        selectedFile = preparation.files[0];
      } else {
        // 複数ファイルの場合は QuickPick で選択
        const picked = await vscode.window.showQuickPick(
          preparation.files.map((f) => ({
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
      const content = await copySourceAtExecutionUseCase.loadContent(
        item.executionId,
        selectedFile,
      );
      if (content === undefined) {
        vscode.window.showErrorMessage('実行情報が見つかりません');
        return;
      }

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
