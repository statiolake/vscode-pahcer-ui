import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Execution } from '../domain/models/execution';
import type { SeedAnalysis } from '../domain/models/resultMetadata';
import { FileAnalyzer } from './fileAnalyzer';
import { TestCaseRepository } from './testCaseRepository';

/**
 * ファイルタイプ
 */
export type FileType = 'in' | 'out' | 'err';

/**
 * 入力・出力・エラーファイルを統合管理するリポジトリ
 *
 * 責務:
 * - ファイルパスの一元管理（tools/in, tools/out, tools/err, .pahcer-ui/results）
 * - ファイルの読み込み・存在確認
 * - 実行結果のコピーと解析
 */
export class InOutRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * Seed番号を4桁の文字列にフォーマット
	 */
	private formatSeed(seed: number): string {
		return String(seed).padStart(4, '0');
	}

	/**
	 * 最新のファイルパスを取得（tools/{type}/nnnn.txt）
	 */
	getLatestPath(type: FileType, seed: number): string {
		return path.join(this.workspaceRoot, 'tools', type, `${this.formatSeed(seed)}.txt`);
	}

	/**
	 * 過去の実行結果のファイルパスを取得（.pahcer-ui/results/result_{id}/{type}/nnnn.txt）
	 */
	getArchivedPath(type: FileType, resultId: string, seed: number): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			type,
			`${this.formatSeed(seed)}.txt`,
		);
	}

	/**
	 * ファイルパスを取得（resultIdがあればアーカイブ、なければ最新）
	 */
	getPath(type: FileType, seed: number, resultId?: string): string {
		return resultId ? this.getArchivedPath(type, resultId, seed) : this.getLatestPath(type, seed);
	}

	/**
	 * ファイルが存在するかチェック
	 */
	exists(type: FileType, seed: number, resultId?: string): boolean {
		const filePath = this.getPath(type, seed, resultId);
		return fs.existsSync(filePath);
	}

	/**
	 * ファイルを読み込む
	 */
	async load(type: FileType, seed: number, resultId?: string): Promise<string | null> {
		const filePath = this.getPath(type, seed, resultId);

		if (!fs.existsSync(filePath)) {
			return null;
		}

		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch (e) {
			console.error(`Failed to read ${type} file for seed ${seed}:`, e);
			return null;
		}
	}

	/**
	 * 出力ファイルをコピーし、解析を実行してmeta.jsonに保存
	 */
	async copyOutputFiles(
		resultId: string,
		execution: Execution,
		commitHash?: string,
	): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);

		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Copy tools/out directory
		const toolsOutDir = path.join(this.workspaceRoot, 'tools', 'out');
		if (fs.existsSync(toolsOutDir)) {
			const outDestDir = path.join(destDir, 'out');
			fs.cpSync(toolsOutDir, outDestDir, { recursive: true });
		}

		// Copy tools/err directory
		const toolsErrDir = path.join(this.workspaceRoot, 'tools', 'err');
		if (fs.existsSync(toolsErrDir)) {
			const errDestDir = path.join(destDir, 'err');
			fs.cpSync(toolsErrDir, errDestDir, { recursive: true });
		}

		// Analyze files and save to meta.json
		await this.analyzeAndSaveMetadata(resultId, execution.id, commitHash);
	}

	/**
	 * 既存のmeta.jsonを更新（コミットハッシュなど）
	 */
	async saveExecutionMetadata(resultId: string, updates: { commitHash?: string }): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);
		const metaPath = path.join(destDir, 'meta.json');

		if (!fs.existsSync(metaPath)) {
			return;
		}

		try {
			const content = fs.readFileSync(metaPath, 'utf-8');
			const metadata = JSON.parse(content);

			// Update with new values
			if (updates.commitHash) {
				metadata.commitHash = updates.commitHash;
			}

			fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
		} catch (e) {
			console.error(`Failed to update meta.json for result ${resultId}:`, e);
		}
	}

	/**
	 * ファイル解析を実行してmeta.jsonに保存
	 */
	private async analyzeAndSaveMetadata(
		resultId: string,
		executionId: string,
		commitHash?: string,
	): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);
		const metaPath = path.join(destDir, 'meta.json');

		// Load test cases and collect seeds for this execution
		const testCaseRepository = new TestCaseRepository(this.workspaceRoot);
		const allTestCases = await testCaseRepository.loadAllTestCases();
		const executionTestCases = allTestCases.filter((tc) => tc.executionId === executionId);
		const seeds = executionTestCases.map((tc) => tc.seed);

		// Prepare file paths for parallel reading
		const inputPaths = seeds.map((seed) => this.getLatestPath('in', seed));
		const stderrPaths = seeds.map((seed) => this.getArchivedPath('err', resultId, seed));

		// Parallel file analysis
		const [inputResults, stderrResults] = await Promise.all([
			FileAnalyzer.readFirstLinesParallel(inputPaths),
			FileAnalyzer.parseStderrVariablesParallel(stderrPaths),
		]);

		// Build analysis object
		const analysis: Record<number, SeedAnalysis> = {};
		for (let i = 0; i < seeds.length; i++) {
			const seed = seeds[i];
			const inputPath = inputPaths[i];
			const stderrPath = stderrPaths[i];

			analysis[seed] = {
				firstInputLine: inputResults.get(inputPath) || '',
				stderrVars: stderrResults.get(stderrPath) || {},
			};
		}

		// Save metadata
		const metadata = {
			commitHash,
			analysis,
		};

		fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
	}
}
