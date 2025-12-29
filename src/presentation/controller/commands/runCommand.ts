import * as vscode from 'vscode';
import type { RunPahcerUseCase } from '../../../application/runPahcerUseCase';
import type { PahcerTreeViewController } from '../pahcerTreeViewController';

/**
 * Git統合を有効にするか確認するダイアログを表示
 */
async function confirmGitIntegration(): Promise<boolean> {
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

  return result !== undefined && result.title === '有効にする';
}

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
  runPahcerUseCase: RunPahcerUseCase,
  treeViewController: PahcerTreeViewController,
): () => Promise<void> {
  return async () => {
    try {
      const result = await runPahcerUseCase.handle({
        options: {},
        confirmGitIntegration,
      });
      treeViewController.refresh();

      // ユースケースからのメッセージを表示
      for (const message of result.messages) {
        vscode.window.showInformationMessage(message);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`実行に失敗しました: ${errorMessage}`);
    }
  };
}
