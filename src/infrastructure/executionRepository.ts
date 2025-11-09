import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Execution } from '../domain/models/execution';

/**
 * JSONファイルから読み込んだ生データの型（pahcer が出力する JSON 形式）
 * メタデータのみを抽出する（cases は TestCaseRepository が処理）
 */
interface RawExecutionData {
	start_time: string;
	comment: string;
	tag_name: string | null;
}

/**
 * 実行IDからファイル名を計算
 */
function getResultFileName(executionId: string): string {
	return `result_${executionId}.json`;
}

/**
 * テスト実行のリポジトリ
 * pahcer が出力する JSON ファイルからメタデータのみを読み込み、Execution エンティティとして返す
 * テストケースは TestCaseRepository が負責
 */
export class ExecutionRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 最新N件の実行を読み込む（デフォルトは全件）
	 */
	async loadLatestExecutions(limit = Number.POSITIVE_INFINITY): Promise<Execution[]> {
		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');

		if (!fs.existsSync(jsonDir)) {
			return [];
		}

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

				// メタデータのみを抽出
				const execution: Execution = {
					id: executionId,
					startTime: raw.start_time,
					comment: raw.comment,
					tagName: raw.tag_name ?? null,
				};

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
						console.log(`error loading metadata for ${executionId}: ${e}`);
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
			const content = fs.readFileSync(jsonPath, 'utf-8');
			const raw: RawExecutionData = JSON.parse(content);

			const execution: Execution = {
				id: executionId,
				startTime: raw.start_time,
				comment: raw.comment,
				tagName: raw.tag_name ?? null,
			};

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
					console.log(`error loading metadata for ${executionId}: ${e}`);
				}
			}

			return execution;
		} catch (e) {
			console.error(`Failed to load execution ${executionId}:`, e);
			return null;
		}
	}

	/**
	 * 実行のコメントを更新する
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
			const raw = JSON.parse(content);

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
