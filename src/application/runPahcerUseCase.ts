import { promises as fs } from 'node:fs';
import type { ExecutionRepository } from '../infrastructure/executionRepository';
import type { GitAdapter } from '../infrastructure/gitAdapter';
import type { InOutRepository } from '../infrastructure/inOutRepository';
import type { PahcerAdapter, PahcerRunOptions } from '../infrastructure/pahcerAdapter';
import type { PahcerConfigFileRepository } from '../infrastructure/pahcerConfigFileRepository';
import { TestCaseRepository } from '../infrastructure/testCaseRepository';

/**
 * pahcer run の実行結果
 */
export interface PahcerRunResult {
	exitCode: number | undefined;
	commitHash: string | null;
	resultId: string | null;
	caseCount: number;
	totalScore: number;
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
		private pahcerConfigFileRepository: PahcerConfigFileRepository,
		private workspaceRoot: string,
	) {}

	/**
	 * pahcer run を実行（全オーケストレーション含む）
	 */
	async run(options?: PahcerRunOptions): Promise<PahcerRunResult> {
		const result: PahcerRunResult = {
			exitCode: undefined,
			commitHash: null,
			resultId: null,
			caseCount: 0,
			totalScore: 0,
		};

		// Step 1: Git統合 - 実行前にソースコードをコミット
		try {
			result.commitHash = await this.gitAdapter.commitSourceBeforeExecution();
		} catch (error) {
			throw new Error(`gitの操作に失敗しました: ${error}`);
		}

		// Step 2: テンポラリ設定ファイルを作成（必要な場合）
		let tempConfigPath: string | null = null;
		if (options?.startSeed !== undefined || options?.endSeed !== undefined) {
			tempConfigPath = await this.createTempConfig(options);
		}

		try {
			// Step 3: pahcer runコマンドを実行
			result.exitCode = await this.pahcerAdapter.run(options, tempConfigPath);

			// Step 4: 最新の実行結果を取得
			const latestExecution = await this.executionRepository.getLatestExecution();
			if (!latestExecution) {
				throw new Error('実行結果を取得できませんでした');
			}

			result.resultId = latestExecution.id;

			// Step 5: 出力ファイルをコピー
			await this.inOutRepository.copyOutputFiles(latestExecution.id);

			// Step 6: 実行結果を解析してメタデータを保存
			const testCaseRepository = new TestCaseRepository(this.workspaceRoot);
			await this.analyzeExecution(latestExecution.id, testCaseRepository);

			// Step 7: テストケースデータから統計情報を取得
			const allTestCases = await testCaseRepository.loadAllTestCases();
			const executionTestCases = allTestCases.filter((tc) => tc.executionId === latestExecution.id);
			result.caseCount = executionTestCases.length;
			result.totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);

			// Step 8: Git統合 - 実行後に結果をコミット
			try {
				await this.gitAdapter.commitResultsAfterExecution(result.caseCount, result.totalScore);
			} catch (error) {
				throw new Error(`結果コミットに失敗しました: ${error}`);
			}
		} finally {
			// Step 9: テンポラリ設定ファイルをクリーンアップ
			if (tempConfigPath) {
				try {
					await fs.unlink(tempConfigPath);
				} catch (error) {
					// ファイルが存在しない場合などは無視
					console.warn(`Failed to delete temp config file: ${error}`);
				}
			}
		}

		return result;
	}

	/**
	 * 実行結果を解析してメタデータを保存
	 */
	private async analyzeExecution(
		executionId: string,
		testCaseRepository: TestCaseRepository,
	): Promise<void> {
		// すべてのテストケースを読み込む
		const allTestCases = await testCaseRepository.loadAllTestCases();

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
		await testCaseRepository.saveMany(testCasesToSave);
	}

	/**
	 * テンポラリ設定ファイルを作成
	 */
	private async createTempConfig(options: PahcerRunOptions): Promise<string> {
		// Read original config from infrastructure layer
		let configContent = this.pahcerConfigFileRepository.read();

		// Replace start_seed and end_seed if specified
		if (options.startSeed !== undefined) {
			configContent = configContent.replace(
				/start_seed\s*=\s*\d+/,
				`start_seed = ${options.startSeed}`,
			);
		}
		if (options.endSeed !== undefined) {
			configContent = configContent.replace(/end_seed\s*=\s*\d+/, `end_seed = ${options.endSeed}`);
		}

		// Create temp file with modified config
		const tempFilePath = `${this.workspaceRoot}/.pahcer-temp-config.toml`;
		await fs.writeFile(tempFilePath, configContent);

		return tempFilePath;
	}
}
