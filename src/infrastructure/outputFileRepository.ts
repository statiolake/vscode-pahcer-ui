import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PahcerResult } from '../domain/models/pahcerResult';
import type { SeedAnalysis } from '../domain/models/resultMetadata';
import { FileAnalyzer } from './fileAnalyzer';

/**
 * 出力ファイルのリポジトリ
 */
export class OutputFileRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 最新の出力ファイルのパスを取得
	 */
	getLatestOutputPath(seed: number): string {
		return path.join(this.workspaceRoot, 'tools', 'out', `${String(seed).padStart(4, '0')}.txt`);
	}

	/**
	 * 過去の実行結果の出力ファイルのパスを取得
	 */
	getOutputPath(resultId: string, seed: number): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${resultId}`,
			'out',
			`${String(seed).padStart(4, '0')}.txt`,
		);
	}

	/**
	 * 出力ファイルを読み込む
	 */
	async load(seed: number, resultId?: string): Promise<string | null> {
		const outputPath = resultId
			? this.getOutputPath(resultId, seed)
			: this.getLatestOutputPath(seed);

		if (!fs.existsSync(outputPath)) {
			return null;
		}

		try {
			return fs.readFileSync(outputPath, 'utf-8');
		} catch (e) {
			console.error(`Failed to read output file for seed ${seed}:`, e);
			return null;
		}
	}

	/**
	 * 出力ファイルが存在するかチェック
	 */
	exists(seed: number, resultId?: string): boolean {
		const outputPath = resultId
			? this.getOutputPath(resultId, seed)
			: this.getLatestOutputPath(seed);
		return fs.existsSync(outputPath);
	}

	/**
	 * 出力ファイルをコピーし、解析を実行してmeta.jsonに保存
	 */
	async copyOutputFiles(
		resultId: string,
		pahcerResult: PahcerResult,
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
		await this.analyzeAndSaveMetadata(resultId, pahcerResult, commitHash);
	}

	/**
	 * ファイル解析を実行してmeta.jsonに保存
	 */
	private async analyzeAndSaveMetadata(
		resultId: string,
		pahcerResult: PahcerResult,
		commitHash?: string,
	): Promise<void> {
		const destDir = path.join(this.workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);
		const metaPath = path.join(destDir, 'meta.json');

		// Collect all seeds from pahcerResult
		const seeds = pahcerResult.cases.map((c) => c.seed);

		// Prepare file paths for parallel reading
		const inputPaths = seeds.map((seed) =>
			path.join(this.workspaceRoot, 'tools', 'in', `${String(seed).padStart(4, '0')}.txt`),
		);
		const stderrPaths = seeds.map((seed) =>
			path.join(destDir, 'err', `${String(seed).padStart(4, '0')}.txt`),
		);

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
