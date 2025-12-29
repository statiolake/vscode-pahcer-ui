import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IFileAnalyzer } from '../domain/interfaces/IFileAnalyzer';
import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import type { PahcerConfig } from '../domain/models/configFile';
import type { PahcerRunOptions } from '../domain/models/pahcerStatus';
import type { CommitResultsUseCase, ConfirmGitIntegration } from './commitResultsUseCase';
import { PreconditionFailedError, ResourceNotFoundError } from './exceptions';

export interface RunUseCaseRequest {
  options: PahcerRunOptions;
  confirmGitIntegration: ConfirmGitIntegration;
}

export interface RunUseCaseResult {
  messages: string[];
}

/**
 * pahcer実行ユースケース
 *
 * 責務:
 * - Git統合（実行前後のコミット）
 * - pahcer runコマンドの実行
 * - 出力ファイルのコピー
 * - 実行結果の解析とメタデータ保存
 *
 * フロー:
 * 1. 古い出力ファイルを削除
 * 2. Git統合：実行前にソースコードをコミット（CommitResultsUseCase）
 * 3. テンポラリ設定ファイル作成（必要な場合）
 * 4. pahcer runコマンド実行
 * 5. テンポラリファイルクリーンアップ
 * 6. 出力ファイルをコピー
 * 7. アーカイブ済みの出力ファイルを削除
 * 8. 実行結果を解析してメタデータ保存
 * 9. Git統合：実行後に結果をコミット（CommitResultsUseCase）
 */
export class RunPahcerUseCase {
  constructor(
    private pahcerAdapter: IPahcerAdapter,
    private commitResultsUseCase: CommitResultsUseCase,
    private inOutFilesAdapter: IInOutFilesAdapter,
    private fileAnalyzer: IFileAnalyzer,
    private executionRepository: IExecutionRepository,
    private testCaseRepository: ITestCaseRepository,
    private pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  /**
   * pahcer run を実行（全オーケストレーション含む）
   */
  async handle(request: RunUseCaseRequest): Promise<RunUseCaseResult> {
    const { options, confirmGitIntegration } = request;
    const messages: string[] = [];

    // 古い出力ファイルを削除（前回の実行結果のクリーンアップ）
    await this.inOutFilesAdapter.removeOutputs();

    // Git統合 - 実行前にソースコードをコミット
    const beforeResult =
      await this.commitResultsUseCase.commitBeforeExecution(confirmGitIntegration);
    if (beforeResult.message) {
      messages.push(beforeResult.message);
    }

    // テンポラリ設定ファイルを作成（必要な場合）
    const tempConfig = await this.prepareTemporaryConfig(options);

    // pahcer runコマンドを実行
    try {
      await this.pahcerAdapter.run(options, tempConfig);
    } finally {
      if (tempConfig) {
        // テンポラリ設定ファイルをクリーンアップ
        await this.pahcerConfigRepository.delete('temporary');
      }
    }

    // 最新の実行結果を取得
    const allExecutions = await this.executionRepository.findAll();
    if (allExecutions.length === 0) {
      throw new PreconditionFailedError('実行結果が取得できませんでした');
    }
    const latestExecution = allExecutions[0];

    // 出力ファイルをコピー
    await this.inOutFilesAdapter.archiveOutputs(latestExecution.id);

    // アーカイブ済みの出力ファイルを削除
    await this.inOutFilesAdapter.removeOutputs();

    // 実行結果を解析してメタデータを保存
    await this.analyzeExecution(latestExecution.id);

    // コミットハッシュを保存
    if (beforeResult.commitHash) {
      latestExecution.commitHash = beforeResult.commitHash;
      await this.executionRepository.upsert(latestExecution);
    }

    // テストケースデータから統計情報を取得
    const executionTestCases = await this.testCaseRepository.findByExecutionId(latestExecution.id);
    const caseCount = executionTestCases.length;
    const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);

    // Git統合 - 実行後に結果をコミット
    const afterResult = await this.commitResultsUseCase.commitAfterExecution(caseCount, totalScore);
    if (afterResult.message) {
      messages.push(afterResult.message);
    }

    return { messages };
  }

  /**
   * テンポラリ設定ファイルを準備 (必要な場合)
   */
  private async prepareTemporaryConfig(
    options: PahcerRunOptions,
  ): Promise<PahcerConfig | undefined> {
    if (options.startSeed === undefined && options.endSeed === undefined) {
      // テンポラリ設定ファイルは不要
      return undefined;
    }

    const tempConfig = await this.pahcerConfigRepository.findById('temporary');
    if (!tempConfig) {
      throw new ResourceNotFoundError('テンポラリ設定ファイル');
    }

    // Seed範囲オプションが指定されている場合、テンポラリ設定を更新
    if (options.startSeed !== undefined) {
      tempConfig.startSeed = options.startSeed;
    }
    if (options.endSeed !== undefined) {
      tempConfig.endSeed = options.endSeed;
    }

    // 更新した設定を保存
    await this.pahcerConfigRepository.upsert(tempConfig);

    return tempConfig;
  }

  /**
   * 実行結果を解析してメタデータを保存
   */
  private async analyzeExecution(executionId: string): Promise<void> {
    const testCases = await this.testCaseRepository.findByExecutionId(executionId);

    // 各テストケースにメタデータを追加して保存
    await Promise.all(
      testCases.map(async (tc) => {
        const inputPath = this.inOutFilesAdapter.getNonArchivedPath('in', tc.id.seed);
        const stderrPath = this.inOutFilesAdapter.getArchivedPath('err', tc.id);

        // 解析データを取得
        const firstInputLine = await this.fileAnalyzer.readFirstLine(inputPath);
        const stderrVars = (await this.fileAnalyzer.parseStderrVariables(stderrPath)) || {};

        // TestCaseに解析データを追加
        tc.firstInputLine = firstInputLine;
        tc.stderrVars = stderrVars;

        await this.testCaseRepository.upsert(tc);
      }),
    );
  }
}
