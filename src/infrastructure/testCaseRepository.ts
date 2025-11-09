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
 */
export class TestCaseRepository {
	constructor(private workspaceRoot: string) {}

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

					testCases.push({
						executionId,
						seed: c.seed,
						score: c.score,
						executionTime: c.execution_time,
						errorMessage: c.error_message,
						foundOutput,
					});
				}
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		return testCases;
	}
}
