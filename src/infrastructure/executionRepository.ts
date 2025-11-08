import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Execution } from '../domain/models/execution';
import { calculateRelativeScore } from '../domain/services/relativeScoreService';
import { BestScoresRepository } from './bestScoresRepository';
import { SettingsRepository } from './settingsRepository';

/**
 * JSONファイルから読み込んだ生データの型（pahcer が出力する JSON 形式）
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
 * 生データをドメインモデルに変換
 * @param raw JSONファイルから読み込んだ生データ
 * @param executionId 実行ID（例: "20250111_123456"）
 * @param workspaceRoot ワークスペースのルートパス
 * @param bestScores seed => ベストスコア のマップ（相対スコア再計算用）
 * @param objective 最適化の方向（相対スコア再計算用）
 */
function convertToDomainModel(
	raw: RawExecutionData,
	executionId: string,
	workspaceRoot: string,
	bestScores?: Map<number, number>,
	objective?: 'max' | 'min',
): Execution {
	// Get list of existing output files once (instead of checking each file individually)
	const outDir = path.join(workspaceRoot, '.pahcer-ui', 'results', `result_${executionId}`, 'out');
	const existingFiles = new Set<string>(fs.existsSync(outDir) ? fs.readdirSync(outDir) : []);

	// 相対スコアを再計算するかどうかを判定
	const shouldRecalculateRelativeScore = bestScores && objective;

	const cases = raw.cases.map((c) => {
		const seedStr = String(c.seed).padStart(4, '0');
		const foundOutput = existingFiles.has(`${seedStr}.txt`);

		// 相対スコアを再計算する場合は、ベストスコアを使用して新しい相対スコアを計算
		let relativeScore = c.relative_score;
		if (shouldRecalculateRelativeScore) {
			const bestScore = bestScores.get(c.seed);
			relativeScore = calculateRelativeScore(c.score, bestScore, objective);
		}

		return {
			seed: c.seed,
			score: c.score,
			relativeScore,
			executionTime: c.execution_time,
			errorMessage: c.error_message,
			foundOutput,
		};
	});

	return {
		id: executionId,
		startTime: raw.start_time,
		caseCount: raw.case_count,
		totalScore: raw.total_score,
		totalScoreLog10: raw.total_score_log10,
		maxExecutionTime: raw.max_execution_time,
		comment: raw.comment,
		tagName: raw.tag_name,
		waSeeds: raw.wa_seeds,
		cases,
	};
}

/**
 * 実行IDからファイル名を計算
 */
function getResultFileName(executionId: string): string {
	return `result_${executionId}.json`;
}

/**
 * テスト実行のリポジトリ
 * pahcer が出力する JSON ファイルを読み込み、Execution エンティティとして返す
 */
export class ExecutionRepository {
	private bestScoresRepository: BestScoresRepository;
	private settingsRepository: SettingsRepository;

	constructor(private workspaceRoot: string) {
		this.bestScoresRepository = new BestScoresRepository(workspaceRoot);
		this.settingsRepository = new SettingsRepository(workspaceRoot);
	}

	/**
	 * 最新N件の実行を読み込む（デフォルトは全件）
	 */
	async loadLatestExecutions(limit = Number.POSITIVE_INFINITY): Promise<Execution[]> {
		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [];
		}

		// 相対スコア再計算に必要なデータを先に読み込む
		const bestScores = await this.bestScoresRepository.loadBestScores();
		const settings = await this.settingsRepository.loadSettings();

		const files = fs
			.readdirSync(jsonDir)
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse()
			.slice(0, limit);

		const executions: Execution[] = [];

		for (const file of files) {
			try {
				const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
				const raw: RawExecutionData = JSON.parse(content);
				const executionId = file.replace(/^result_(.+)\.json$/, '$1');

				const execution = convertToDomainModel(
					raw,
					executionId,
					this.workspaceRoot,
					bestScores,
					settings.objective,
				);

				// Load commit hash from meta.json
				const metaPath = path.join(
					this.workspaceRoot,
					'.pahcer-ui',
					'results',
					`result_${executionId}`,
					'meta.json',
				);
				if (fs.existsSync(metaPath)) {
					try {
						const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
						execution.commitHash = metadata.commitHash;
					} catch (e) {
						console.log(`error listing latest results: ${e}`);
					}
				}

				executions.push(execution);
			} catch (e) {
				console.error(`Failed to load ${file}:`, e);
			}
		}

		return executions;
	}

	/**
	 * 最新の実行を1件取得
	 */
	async getLatestExecution(): Promise<Execution | null> {
		const executions = await this.loadLatestExecutions(1);
		return executions.length > 0 ? executions[0] : null;
	}

	/**
	 * 特定の実行を読み込む
	 */
	async loadExecution(executionId: string): Promise<Execution | null> {
		const jsonPath = path.join(
			this.workspaceRoot,
			'pahcer',
			'json',
			getResultFileName(executionId),
		);

		if (!fs.existsSync(jsonPath)) {
			return null;
		}

		try {
			// 相対スコア再計算に必要なデータを先に読み込む
			const bestScores = await this.bestScoresRepository.loadBestScores();
			const settings = await this.settingsRepository.loadSettings();

			const content = fs.readFileSync(jsonPath, 'utf-8');
			const raw: RawExecutionData = JSON.parse(content);
			const execution = convertToDomainModel(
				raw,
				executionId,
				this.workspaceRoot,
				bestScores,
				settings.objective,
			);

			// Load commit hash from meta.json
			const metaPath = path.join(
				this.workspaceRoot,
				'.pahcer-ui',
				'results',
				`result_${executionId}`,
				'meta.json',
			);
			if (fs.existsSync(metaPath)) {
				try {
					const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
					execution.commitHash = metadata.commitHash;
				} catch (e) {
					console.log(`error loading commit hash for ${executionId}: ${e}`);
				}
			}

			return execution;
		} catch (e) {
			console.error(`Failed to load result ${executionId}:`, e);
			return null;
		}
	}

	/**
	 * 実行のコメントを更新する（pahcer本体のJSONファイルを直接書き換え）
	 */
	async updateExecutionComment(executionId: string, comment: string): Promise<void> {
		const jsonPath = path.join(
			this.workspaceRoot,
			'pahcer',
			'json',
			getResultFileName(executionId),
		);

		if (!fs.existsSync(jsonPath)) {
			throw new Error(`Execution file not found: ${jsonPath}`);
		}

		try {
			// JSONファイルを読み込む
			const content = fs.readFileSync(jsonPath, 'utf-8');
			const raw: RawExecutionData = JSON.parse(content);

			// commentフィールドを更新
			raw.comment = comment;

			// JSONファイルに書き戻す（インデントを保持）
			fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2), 'utf-8');
		} catch (e) {
			console.error(`Failed to update comment for ${executionId}:`, e);
			throw e;
		}
	}
}
