import type { PahcerConfig } from '../domain/models/configFile';
import type { ExecutionRepository } from '../infrastructure/executionRepository';
import { FileAnalyzer } from '../infrastructure/fileAnalyzer';
import type { GitAdapter } from '../infrastructure/gitAdapter';
import type { InOutFilesAdapter } from '../infrastructure/inOutFilesAdapter';
import type { PahcerAdapter, PahcerRunOptions } from '../infrastructure/pahcerAdapter';
import type { PahcerConfigRepository } from '../infrastructure/pahcerConfigRepository';
import type { TestCaseRepository } from '../infrastructure/testCaseRepository';

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
 * 2. Git統合：実行前にソースコードをコミット
 * 3. テンポラリ設定ファイル作成（必要な場合）
 * 4. pahcer runコマンド実行
 * 5. テンポラリファイルクリーンアップ
 * 6. 出力ファイルをコピー
 * 7. アーカイブ済みの出力ファイルを削除
 * 8. 実行結果を解析してメタデータ保存
 * 9. Git統合：実行後に結果をコミット
 */
export class RunPahcerUseCase {
  constructor(
    private pahcerAdapter: PahcerAdapter,
    private gitAdapter: GitAdapter,
    private inOutFilesAdapter: InOutFilesAdapter,
    private executionRepository: ExecutionRepository,
    private testCaseRepository: TestCaseRepository,
    private pahcerConfigRepository: PahcerConfigRepository,
  ) {}

  /**
   * pahcer run を実行（全オーケストレーション含む）
   */
  async run(options?: PahcerRunOptions): Promise<void> {
    options = options ?? {};

    // Step 1: 古い出力ファイルを削除（前回の実行結果のクリーンアップ）
    await this.inOutFilesAdapter.removeOutputs();

    // Step 2: Git統合 - 実行前にソースコードをコミット
    let commitHash: string | null;
    try {
      commitHash = await this.gitAdapter.commitSourceBeforeExecution();
    } catch (error) {
      throw new Error(`gitの操作に失敗しました: ${error}`);
    }

    // Step 3: テンポラリ設定ファイルを作成（必要な場合）
    let tempConfig: PahcerConfig | undefined;
    if (options.startSeed !== undefined || options.endSeed !== undefined) {
      tempConfig = await this.pahcerConfigRepository.get('temporary');

      // Seed範囲オプションが指定されている場合、テンポラリ設定を更新
      if (options.startSeed !== undefined) {
        tempConfig.startSeed = options.startSeed;
      }
      if (options.endSeed !== undefined) {
        tempConfig.endSeed = options.endSeed;
      }

      // 更新した設定を保存
      await this.pahcerConfigRepository.save(tempConfig);
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
    const allExecutions = await this.executionRepository.getAll();
    if (allExecutions.length === 0) {
      throw new Error('実行結果を取得できませんでした');
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
      await this.executionRepository.save(latestExecution);
    }

    // Step 7: テストケースデータから統計情報を取得
    const executionTestCases = await this.testCaseRepository.findByExecutionId(latestExecution.id);
    const caseCount = executionTestCases.length;
    const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);

    // Step 8: Git統合 - 実行後に結果をコミット
    try {
      await this.gitAdapter.commitResultsAfterExecution(caseCount, totalScore);
    } catch (error) {
      throw new Error(`結果コミットに失敗しました: ${error}`);
    }
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
        const firstInputLine = await FileAnalyzer.readFirstLine(inputPath);
        const stderrVars = (await FileAnalyzer.parseStderrVariables(stderrPath)) || {};

        // TestCaseに解析データを追加
        tc.firstInputLine = firstInputLine;
        tc.stderrVars = stderrVars;

        await this.testCaseRepository.upsert(tc);
      }),
    );
  }
}
