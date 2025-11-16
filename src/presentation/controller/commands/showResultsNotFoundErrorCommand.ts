import * as vscode from 'vscode';

/**
 * 結果が見つからないエラーを表示するコマンドハンドラ
 */
export function showResultsNotFoundErrorCommand(): (seed: number) => void {
  return (seed: number) => {
    const seedStr = String(seed).padStart(4, '0');
    vscode.window.showErrorMessage(
      `Seed ${seedStr} の結果が見つからないため、ビジュアライザを開けません。`,
    );
  };
}
