import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TestCase } from '../domain/models/testCase';

/**
 * JSONファイルから読み込んだ生データの型
 */
interface RawExecutionData {
	start_time: string;
	case_count: number;
	total_score: number;
	total_score_log10: number;
	total_relative_score: number;
	max_execution_time: number;
	comment: string;
	tag_name: string | null;
	wa_seeds: number[];
	cases: Array<{
		seed: number;
		score: number;
		relative_score: number;
		execution_time: number;
		error_message: string;
	}>;
}

/**
 * テストケースリポジトリ
 * すべての TestCase を実行の垣根なく読み込む
 * メタデータ（解析データ）の読み書きも管理
 *
 * ストレージ構造:
 * .pahcer-ui/results/result_${id}/
 *   meta/
 *     execution.json     (実行レベルメタデータ: commitHash等)
 *     testcase_0000.json (seed毎の解析データ: firstInputLine, stderrVars)
 *     testcase_0001.json
 *     ...
 */
export class TestCaseRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * メタディレクトリのパスを取得
	 */
	private getMetaDir(resultId: string): string {
		return path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`, 'meta');
	}

	/**
	 * テストケースメタデータファイルのパスを取得
	 */
	private getTestCaseMetaPath(resultId: string, seed: number): string {
		const seedStr = String(seed).padStart(4, '0');
		return path.join(this.getMetaDir(resultId), `testcase_${seedStr}.json`);
	}

	/**
	 * すべてのテストケースを読み込む
	 */
	async loadAllTestCases(): Promise<TestCase[]> {
		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [];
		}

		const testCases: TestCase[] = [];
		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse();

		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const raw: RawExecutionData = JSON.parse(content);
				const executionId = file.replace(/^result_(.+)\.json$/, '$1');

				// 出力ファイルの存在チェック
				const outDir = path.join(
					this.workspaceRoot,
					'.pahcer-ui',
					'results',
					`result_${executionId}`,
					'out',
				);
				const existingFiles = new Set<string>(fs.existsSync(outDir) ? fs.readdirSync(outDir) : []);

				// 各テストケースを TestCase に変換
				for (const c of raw.cases) {
					const seedStr = String(c.seed).padStart(4, '0');
					const foundOutput = existingFiles.has(`${seedStr}.txt`);

					const testCase: TestCase = {
						executionId,
						seed: c.seed,
						score: c.score,
						executionTime: c.execution_time,
						errorMessage: c.error_message,
						foundOutput,
					};

					// メタデータがあれば読み込む
					const metadata = await this.loadTestCaseMetadata(executionId, c.seed);
					if (metadata) {
						testCase.firstInputLine = metadata.firstInputLine;
						testCase.stderrVars = metadata.stderrVars;
					}

					testCases.push(testCase);
				}
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		return testCases;
	}

	/**
	 * テストケースメタデータを読み込む
	 */
	private async loadTestCaseMetadata(
		resultId: string,
		seed: number,
	): Promise<{ firstInputLine: string; stderrVars: Record<string, number> } | null> {
		const metaPath = this.getTestCaseMetaPath(resultId, seed);

		if (!fs.existsSync(metaPath)) {
			return null;
		}

		try {
			const content = fs.readFileSync(metaPath, 'utf-8');
			return JSON.parse(content);
		} catch (e) {
			console.error(`Failed to load metadata for ${resultId}:${seed}:`, e);
			return null;
		}
	}

	/**
	 * テストケースを保存（メタデータ込み）
	 */
	async save(testCase: TestCase): Promise<void> {
		const metaDir = this.getMetaDir(testCase.executionId);

		// メタディレクトリを作成
		if (!fs.existsSync(metaDir)) {
			fs.mkdirSync(metaDir, { recursive: true });
		}

		// テストケースのメタデータを保存（analysis情報）
		const metadata = {
			firstInputLine: testCase.firstInputLine || '',
			stderrVars: testCase.stderrVars || {},
		};

		const metaPath = this.getTestCaseMetaPath(testCase.executionId, testCase.seed);
		fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
	}

	/**
	 * 複数のテストケースを一括保存
	 */
	async saveMany(testCases: TestCase[]): Promise<void> {
		for (const testCase of testCases) {
			await this.save(testCase);
		}
	}
}
