import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IFileAnalyzer } from '../domain/interfaces/IFileAnalyzer';
import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import type { PahcerConfig } from '../domain/models/configFile';
import type { PahcerRunOptions } from '../domain/models/pahcerStatus';
import type { CommitResultsUseCase } from './commitResultsUseCase';
import { PreconditionFailedError, ResourceNotFoundError } from './exceptions';

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
  async run(options?: PahcerRunOptions): Promise<void> {
    options = options ?? {};

    // Step 1: 古い出力ファイルを削除（前回の実行結果のクリーンアップ）
    await this.inOutFilesAdapter.removeOutputs();

    // Step 2: Git統合 - 実行前にソースコードをコミット
    const commitHash = await this.commitResultsUseCase.commitBeforeExecution();

    // Step 3: テンポラリ設定ファイルを作成（必要な場合）
    let tempConfig: PahcerConfig | undefined;
    if (options.startSeed !== undefined || options.endSeed !== undefined) {
      tempConfig = await this.pahcerConfigRepository.findById('temporary');
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
    }

    try {
      // Step 4: pahcer runコマンドを実行
      await this.pahcerAdapter.run(options, tempConfig);
    } finally {
      // テンポラリ設定ファイルをクリーンアップ
      if (tempConfig) {
        await this.pahcerConfigRepository.delete('temporary');
      }
    }

    // Step 5: 最新の実行結果を取得
    const allExecutions = await this.executionRepository.findAll();
    if (allExecutions.length === 0) {
      throw new PreconditionFailedError('実行結果が取得できませんでした');
    }
    const latestExecution = allExecutions[0];

    // Step 6: 出力ファイルをコピー
    await this.inOutFilesAdapter.archiveOutputs(latestExecution.id);

    // Step 7: アーカイブ済みの出力ファイルを削除
    await this.inOutFilesAdapter.removeOutputs();

    // Step 8: 実行結果を解析してメタデータを保存
    await this.analyzeExecution(latestExecution.id);

    // Step 6.5: コミットハッシュを保存
    if (commitHash) {
      latestExecution.commitHash = commitHash;
      await this.executionRepository.upsert(latestExecution);
    }

    // Step 7: テストケースデータから統計情報を取得
    const executionTestCases = await this.testCaseRepository.findByExecutionId(latestExecution.id);
    const caseCount = executionTestCases.length;
    const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);

    // Step 9: Git統合 - 実行後に結果をコミット
    await this.commitResultsUseCase.commitAfterExecution(caseCount, totalScore);
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
