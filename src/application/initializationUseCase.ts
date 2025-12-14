import type { IGitignoreAdapter } from '../domain/interfaces/IGitignoreAdapter';
import type { IKeybindingContextAdapter } from '../domain/interfaces/IKeybindingContextAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { DownloadedTester, ITesterDownloader } from '../domain/interfaces/ITesterDownloader';

/**
 * UI 層での確認結果を処理するためのコールバック
 */
export interface ITesterConfirmationHandler {
  /**
   * テスター設定の確認を UI 層で実施し、結果を返す
   *
   * @param userSelected ユーザーが選択した設定
   * @param detected テスターから検出された設定
   * @returns true: 検出された設定を使用、false: ユーザー選択を維持
   */
  confirmTesterConfiguration(userSelected: boolean, detected: boolean): Promise<boolean>;
}

export interface InitializeUseCaseRequest {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
  testerUrl: string;
  confirmationHandler: ITesterConfirmationHandler;
}

interface TesterValidationResult {
  isInteractive: boolean;
  needsConfirmation: boolean;
  detectedInteractive?: boolean;
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
    private keybindingContextAdapter: IKeybindingContextAdapter,
    private pahcerAdapter: IPahcerAdapter,
    private pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  /**
   * 初期化処理を実行
   */
  async handle(request: InitializeUseCaseRequest): Promise<void> {
    let finalIsInteractive = request.isInteractive;

    // Step 1: テスターダウンロード（オプション）
    if (request.testerUrl) {
      const result = await this.validateTesterConfiguration(
        request.testerUrl,
        request.isInteractive,
        request.confirmationHandler,
      );
      finalIsInteractive = result.isInteractive;
    }

    // Step 2: .gitignore 更新
    this.updateGitignore();

    // Step 3: keybindingContext から初期化画面を非表示
    await this.keybindingContextAdapter.setShowInitialization(false);

    // Step 4: pahcer init 実行
    await this.pahcerAdapter.init(
      request.problemName,
      request.objective,
      request.language,
      finalIsInteractive,
    );
  }

  /**
   * テスター設定の検証とダウンロード
   */
  private async validateTesterConfiguration(
    testerUrl: string,
    userSelectedInteractive: boolean,
    confirmationHandler: ITesterConfirmationHandler,
  ): Promise<TesterValidationResult> {
    const tester = await this.downloadTester(testerUrl);

    // ユーザー選択と検出されたタイプが異なる場合は確認
    if (tester.seemsInteractive !== userSelectedInteractive) {
      const shouldUseDetected = await confirmationHandler.confirmTesterConfiguration(
        userSelectedInteractive,
        tester.seemsInteractive,
      );

      return {
        isInteractive: shouldUseDetected ? tester.seemsInteractive : userSelectedInteractive,
        needsConfirmation: true,
        detectedInteractive: tester.seemsInteractive,
      };
    }

    return { isInteractive: userSelectedInteractive, needsConfirmation: false };
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
