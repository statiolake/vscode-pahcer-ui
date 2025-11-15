import type { PahcerConfig } from '../domain/models/configFile';
import type { ExecutionRepository } from '../infrastructure/executionRepository';
import type { GitAdapter } from '../infrastructure/gitAdapter';
import type { InOutRepository } from '../infrastructure/inOutRepository';
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
 * 1. Git統合：実行前にソースコードをコミット
 * 2. テンポラリ設定ファイル作成（必要な場合）
 * 3. pahcer runコマンド実行
 * 4. テンポラリファイルクリーンアップ
 * 5. 出力ファイルをコピー
 * 6. 実行結果を解析してメタデータ保存
 * 7. Git統合：実行後に結果をコミット
 */
export class RunPahcerUseCase {
	constructor(
		private pahcerAdapter: PahcerAdapter,
		private gitAdapter: GitAdapter,
		private inOutRepository: InOutRepository,
		private executionRepository: ExecutionRepository,
		private testCaseRepository: TestCaseRepository,
		private pahcerConfigRepository: PahcerConfigRepository,
	) {}

	/**
	 * pahcer run を実行（全オーケストレーション含む）
	 */
	async run(options?: PahcerRunOptions): Promise<void> {
		options = options ?? {};

		// Step 1: Git統合 - 実行前にソースコードをコミット
		let commitHash: string | null;
		try {
			commitHash = await this.gitAdapter.commitSourceBeforeExecution();
		} catch (error) {
			throw new Error(`gitの操作に失敗しました: ${error}`);
		}

		// Step 2: テンポラリ設定ファイルを作成（必要な場合）
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
			// Step 3: pahcer runコマンドを実行
			await this.pahcerAdapter.run(options, tempConfig);
		} finally {
			// テンポラリ設定ファイルをクリーンアップ
			if (tempConfig) {
				await this.pahcerConfigRepository.delete('temporary');
			}
		}

		// Step 4: 最新の実行結果を取得
		const allExecutions = await this.executionRepository.getAll();
		if (allExecutions.length === 0) {
			throw new Error('実行結果を取得できませんでした');
		}
		const latestExecution = allExecutions[0];

		// Step 5: 出力ファイルをコピー
		await this.inOutRepository.copyOutputFiles(latestExecution.id);

		// Step 6: 実行結果を解析してメタデータを保存
		await this.analyzeExecution(latestExecution.id);

		// Step 6.5: コミットハッシュを保存
		if (commitHash) {
			latestExecution.commitHash = commitHash;
			await this.executionRepository.save(latestExecution);
		}

		// Step 7: テストケースデータから統計情報を取得
		const allTestCases = await this.testCaseRepository.loadAllTestCases();
		const executionTestCases = allTestCases.filter((tc) => tc.executionId === latestExecution.id);
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
		const allTestCases = await this.testCaseRepository.loadAllTestCases();
		// この実行IDのテストケースをフィルタ
		const executionTestCases = allTestCases.filter((tc) => tc.executionId === executionId);

		if (executionTestCases.length === 0) {
			return;
		}

		// 並列処理用にファイルパスを収集
		const inputFilePaths = executionTestCases.map((tc) =>
			this.inOutRepository.getLatestPath('in', tc.seed),
		);
		const stderrFilePaths = executionTestCases.map((tc) =>
			this.inOutRepository.getArchivedPath('err', executionId, tc.seed),
		);

		// ファイルを並列読み込み
		const { FileAnalyzer } = await import('../infrastructure/fileAnalyzer');
		const [inputResults, stderrResults] = await Promise.all([
			FileAnalyzer.readFirstLinesParallel(inputFilePaths),
			FileAnalyzer.parseStderrVariablesParallel(stderrFilePaths),
		]);

		// 各テストケースにメタデータを追加して保存
		const testCasesToSave = [];

		for (let i = 0; i < executionTestCases.length; i++) {
			const testCase = executionTestCases[i];
			const inputPath = inputFilePaths[i];
			const stderrPath = stderrFilePaths[i];

			// 解析データを取得
			const firstInputLine = inputResults.get(inputPath) || '';
			const stderrVars = stderrResults.get(stderrPath) || {};

			// TestCaseに解析データを追加
			const enrichedTestCase = {
				...testCase,
				firstInputLine,
				stderrVars,
			};

			testCasesToSave.push(enrichedTestCase);
		}

		// 一括保存
		await this.testCaseRepository.saveMany(testCasesToSave);
	}
}
