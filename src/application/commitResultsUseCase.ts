import type { IGitAdapter } from '../domain/interfaces/IGitAdapter';

/**
 * Git統合の確認ダイアログを表示するためのコールバック型
 * @returns ユーザーがGit統合を有効にする場合はtrue、無効にする場合はfalse
 */
export type ConfirmGitIntegration = () => Promise<boolean>;

/**
 * Git統合設定リポジトリのインターフェース
 */
export interface IGitIntegrationConfig {
  gitIntegration(): Promise<boolean | null>;
  setGitIntegration(enabled: boolean): Promise<void>;
}

/**
 * コミット結果
 */
export interface CommitResult {
  commitHash: string | null;
  message?: string;
}

/**
 * テスト実行結果をコミットするユースケース
 *
 * 責務:
 * - Git統合の設定判定
 * - テストケース統計情報から適切なコミットメッセージを生成
 * - Git結果コミットを実行
 *
 * フロー:
 * 1. Git統合の設定を確認
 * 2. 初回の場合、コールバック経由でユーザーに問い合わせ
 * 3. 統計情報からコミットメッセージを生成
 * 4. Git結果コミットを実行
 * 5. 結果を返す（UI表示は呼び出し元に委譲）
 */
export class CommitResultsUseCase {
  constructor(
    private gitAdapter: IGitAdapter,
    private gitIntegrationConfig: IGitIntegrationConfig,
  ) {}

  /**
   * テスト実行後に結果をコミット
   *
   * @param caseCount テストケース数
   * @param totalScore 総スコア
   * @returns コミット結果（UI表示は呼び出し元に委譲）
   */
  async commitAfterExecution(caseCount: number, totalScore: number): Promise<CommitResult> {
    const gitIntegration = await this.gitIntegrationConfig.gitIntegration();

    // Git統合が無効な場合は何もしない
    if (gitIntegration !== true) {
      return { commitHash: null };
    }

    try {
      // 平均スコアを計算
      const averageScore = caseCount > 0 ? totalScore / caseCount : 0;

      // コミットメッセージを作成
      const message = `Results - ${caseCount} cases, total score: ${totalScore}, avg: ${averageScore.toFixed(2)}`;

      const commitHash = await this.gitAdapter.commitAll(message);

      return {
        commitHash,
        message: `結果コミット作成: ${commitHash.slice(0, 7)}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        commitHash: null,
        message: `結果コミット作成に失敗しました: ${errorMessage}`,
      };
    }
  }

  /**
   * テスト実行前にソースコードをコミット
   *
   * @param confirmGitIntegration Git統合を有効にするか確認するコールバック（初回のみ呼び出し）
   * @returns コミット結果（UI表示は呼び出し元に委譲）
   */
  async commitBeforeExecution(confirmGitIntegration: ConfirmGitIntegration): Promise<CommitResult> {
    let gitIntegration = await this.gitIntegrationConfig.gitIntegration();

    // 初回（未設定）の場合はコールバック経由でユーザーに問い合わせ
    if (gitIntegration === null) {
      // Gitリポジトリでない場合は無効化
      if (!this.gitAdapter.isGitRepository()) {
        return { commitHash: null };
      }

      const userEnabled = await confirmGitIntegration();
      await this.gitIntegrationConfig.setGitIntegration(userEnabled);
      gitIntegration = userEnabled;
    }

    // Git統合が有効な場合はコミット
    if (gitIntegration === true) {
      try {
        const commitHash = await this.gitAdapter.commitAll('Run');
        return {
          commitHash,
          message: `コミット作成: ${commitHash.slice(0, 7)}`,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          commitHash: null,
          message: `コミット作成に失敗しました: ${errorMessage}`,
        };
      }
    }

    return { commitHash: null };
  }
}
