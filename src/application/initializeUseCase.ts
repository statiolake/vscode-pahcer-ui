import type { IGitignoreAdapter } from '../domain/interfaces/IGitignoreAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { DownloadedTester, ITesterDownloader } from '../domain/interfaces/ITesterDownloader';
import { ApplicationError } from './exceptions';

/**
 * テスター設定の確認を UI 層で確認するためのコールバック
 *
 * @param userSelectedInteractive ユーザーがインタラクティブを選択したかどうか
 * @param testerSeemsInteractive インタラクティブ用のテスターが検出されたかどうか
 * @returns true: 検出された設定を使用、false: ユーザー選択を維持
 */
type ConfirmToUseDetected = (
  userSelectedInteractive: boolean,
  testerSeemsInteractive: boolean,
) => Promise<boolean>;

export interface InitializeUseCaseRequest {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
  testerUrl: string;

  /**
   * テスター設定の確認を UI 層で確認するためのコールバック
   *
   * @param userSelectedInteractive ユーザーがインタラクティブを選択したかどうか
   * @param testerSeemsInteractive インタラクティブ用のテスターが検出されたかどうか
   * @returns true: 検出された設定を使用、false: ユーザー選択を維持
   */
  confirmToUseDetected: ConfirmToUseDetected;
}

/** テスターのダウンロードに失敗した場合のエラー */
export class DownloadTesterError extends ApplicationError {}

/** 初期化処理に失敗した場合のエラー */
export class InitializeError extends ApplicationError {}

interface TesterPreparationResult {
  isInteractive: boolean;
}

/**
 * pahcer init を実行するためのユースケース
 *
 * 責務:
 * - ローカルテスターのダウンロード
 * - テスター設定の検証
 * - .gitignore の更新
 * - keybindingContext の管理
 * - pahcer init コマンドの実行
 *
 * フロー:
 * 1. テスターダウンロード（オプション）
 * 2. テスター設定の検証（ダウンロード後）
 * 3. .gitignore を更新
 * 4. keybindingContext から初期化画面を非表示
 * 5. pahcer init コマンド実行
 */
export class InitializeUseCase {
  constructor(
    private testerDownloader: ITesterDownloader,
    private gitignoreAdapter: IGitignoreAdapter,
    private pahcerAdapter: IPahcerAdapter,
    private pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  /**
   * 初期化処理を実行
   */
  async handle(request: InitializeUseCaseRequest): Promise<void> {
    let finalIsInteractive = request.isInteractive;

    // テスターダウンロード（オプション）
    try {
      const result = await this.prepareTester(
        request.testerUrl,
        request.isInteractive,
        request.confirmToUseDetected,
      );
      finalIsInteractive = result.isInteractive;
    } catch (error) {
      throw new DownloadTesterError(`テスターのダウンロードに失敗しました: ${error}`);
    }

    // .gitignore 更新
    this.updateGitignore();

    // pahcer init 実行
    try {
      await this.pahcerAdapter.init(
        request.problemName,
        request.objective,
        request.language,
        finalIsInteractive,
      );
    } catch (error) {
      throw new InitializeError(`初期化処理に失敗しました: ${error}`);
    }
  }

  /**
   * テスター設定の検証とダウンロード
   */
  private async prepareTester(
    testerUrl: string | undefined,
    userSelectedInteractive: boolean,
    confirmToUseDetected: ConfirmToUseDetected,
  ): Promise<TesterPreparationResult> {
    if (!testerUrl) {
      return { isInteractive: userSelectedInteractive };
    }

    const tester = await this.downloadTester(testerUrl);

    // ユーザー選択と検出されたタイプが異なる場合は確認
    if (tester.seemsInteractive !== userSelectedInteractive) {
      const shouldUseDetected = await confirmToUseDetected(
        userSelectedInteractive,
        tester.seemsInteractive,
      );

      return {
        isInteractive: shouldUseDetected ? tester.seemsInteractive : userSelectedInteractive,
      };
    }

    return { isInteractive: userSelectedInteractive };
  }

  /**
   * ローカルテスターをダウンロードして抽出
   */
  private async downloadTester(testerUrl: string): Promise<DownloadedTester> {
    return await this.testerDownloader.downloadAndExtract(testerUrl);
  }

  /**
   * .gitignore に tools/target を追加
   */
  private updateGitignore(): void {
    try {
      this.gitignoreAdapter.addEntry('tools/target');
    } catch (error) {
      // Silently ignore errors - not critical
      console.error('Failed to update .gitignore:', error);
    }
  }

  /**
   * デフォルトのプロジェクト名を取得
   */
  async getDefaultProjectName(): Promise<string> {
    const config = await this.pahcerConfigRepository.findById('normal');
    return config?.problemName ?? 'unknown';
  }
}
