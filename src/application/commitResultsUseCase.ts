import * as vscode from 'vscode';
import type { IGitAdapter } from '../domain/interfaces/IGitAdapter';

/**
 * テスト実行結果をコミットするユースケース
 *
 * 責務:
 * - Git統合の設定判定とユーザー問い合わせ
 * - テストケース統計情報から適切なコミットメッセージを生成
 * - UI メッセージの表示
 *
 * フロー:
 * 1. Git統合の設定を確認
 * 2. 初回の場合、ユーザーに問い合わせ
 * 3. 統計情報からコミットメッセージを生成
 * 4. Git結果コミットを実行
 * 5. 成功/失敗メッセージを表示
 */
export class CommitResultsUseCase {
  constructor(private gitAdapter: IGitAdapter) {}

  /**
   * テスト実行後に結果をコミット
   *
   * @param caseCount テストケース数
   * @param totalScore 総スコア
   * @returns コミットハッシュ、またはコミット不可の場合は null
   */
  async commitAfterExecution(caseCount: number, totalScore: number): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('pahcer-ui');
    const gitIntegration = config.get<boolean>('gitIntegration');

    // Git統合が無効な場合は何もしない
    if (gitIntegration !== true) {
      return null;
    }

    try {
      // 平均スコアを計算
      const averageScore = caseCount > 0 ? totalScore / caseCount : 0;

      // コミットメッセージを作成
      const message = `Results - ${caseCount} cases, total score: ${totalScore}, avg: ${averageScore.toFixed(2)}`;

      const commitHash = await this.gitAdapter.commitAll(message);

      vscode.window.showInformationMessage(`結果コミット作成: ${commitHash.slice(0, 7)}`);
      return commitHash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`結果コミット作成に失敗しました: ${errorMessage}`);
      return null;
    }
  }

  /**
   * テスト実行前にソースコードをコミット
   *
   * @returns コミットハッシュ、またはコミット不可の場合は null
   * @throws PreconditionFailedError Git統合が有効になっていない場合
   */
  async commitBeforeExecution(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('pahcer-ui');
    let gitIntegration = config.get<boolean | null>('gitIntegration');

    // 初回（未設定）の場合はダイアログを表示
    if (gitIntegration === null) {
      // Gitリポジトリでない場合は無効化
      if (!this.gitAdapter.isGitRepository()) {
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
      const commitHash = await this.gitAdapter.commitAll('Run');

      vscode.window.showInformationMessage(`コミット作成: ${commitHash.slice(0, 7)}`);
      return commitHash;
    }

    return null;
  }
}
