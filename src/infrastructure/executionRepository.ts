import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import dayjs from 'dayjs';
import type { Execution } from '../domain/models/execution';

/**
 * JSONファイルから読み込んだ生データの型（pahcer が出力する JSON 形式）
 */
interface ResultJson {
	start_time: string;
	comment: string;
	tag_name: string | null;
}

/**
 * JSONファイルから読み込んだメタデータの型
 */
interface MetadataJson {
	commitHash?: string;
}

class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

/**
 * テスト実行のリポジトリ
 * pahcer が出力する result.json と meta/execution.json を読み書きする
 * テストケースは TestCaseRepository が負責
 */
export class ExecutionRepository {
	constructor(private workspaceRoot: string) {}

	async get(executionId: string): Promise<Execution> {
		// pahcer が出力した result.json から実行情報を読み込む
		let content: string;
		try {
			content = await fs.readFile(this.resultPath(executionId), 'utf-8');
		} catch {
			throw new NotFoundError(`Execution result file not found: ${executionId}`);
		}

		const result: ResultJson = JSON.parse(content);
		const execution: Execution = {
			id: executionId,
			startTime: dayjs(result.start_time),
			comment: result.comment,
			tagName: result.tag_name ?? null,
		};

		// メタデータから commitHash を読み込む
		try {
			const metadata: MetadataJson = JSON.parse(
				await fs.readFile(this.metadataPath(executionId), 'utf-8'),
			);
			execution.commitHash = metadata.commitHash;
		} catch (e) {
			// メタデータがない場合は無視
			console.log(`error loading metadata for ${executionId}: ${e}`);
		}

		return execution;
	}

	async getAll(): Promise<Execution[]> {
		const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');
		if (!existsSync(jsonDir)) {
			return [];
		}

		const files = (await fs.readdir(jsonDir))
			.filter((f) => f.startsWith('result_') && f.endsWith('.json'))
			.sort()
			.reverse();

		const executionIds = files.map((file) => file.replace(/^result_(.+)\.json$/, '$1'));

		return await Promise.all(executionIds.map((id) => this.get(id)));
	}

	async save(execution: Execution): Promise<void> {
		// result.json を書き込む
		const result: ResultJson = {
			start_time: execution.startTime.format('YYYY-MM-DD HH:mm:ss'),
			comment: execution.comment,
			tag_name: execution.tagName,
		};

		const resultPath = this.resultPath(execution.id);
		await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');

		// meta/execution.json を書き込む
		const metadataPath = this.metadataPath(execution.id);
		const metadata: MetadataJson = {
			commitHash: execution.commitHash,
		};
		await fs.mkdir(path.dirname(metadataPath), { recursive: true });
		await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
	}

	private resultPath(executionId: string): string {
		return path.join(this.workspaceRoot, 'pahcer', 'json', `result_${executionId}.json`);
	}

	private metadataPath(executionId: string): string {
		return path.join(
			this.workspaceRoot,
			'.pahcer-ui',
			'results',
			`result_${executionId}`,
			'meta',
			'execution.json',
		);
	}
}
