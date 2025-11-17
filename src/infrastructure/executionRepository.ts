import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import dayjs from 'dayjs';
import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { Execution } from '../domain/models/execution';
import { asErrnoException } from '../util/lang';
import { ExecutionMetadataSchema, ResultJsonSchema } from './schemas';

/**
 * テスト実行のリポジトリ
 * pahcer が出力する result.json と meta/execution.json を読み書きする
 * テストケースは TestCaseRepository が負責
 */
export class ExecutionRepository implements IExecutionRepository {
  constructor(private workspaceRoot: string) {}

  async findById(executionId: string): Promise<Execution | undefined> {
    // pahcer が出力した result.json から実行情報を読み込む
    let content: string;
    try {
      content = await fs.readFile(this.resultPath(executionId), 'utf-8');
    } catch {
      return undefined;
    }

    const result = ResultJsonSchema.parse(JSON.parse(content));
    const execution: Execution = {
      id: executionId,
      startTime: dayjs(result.start_time),
      comment: result.comment,
      tagName: result.tag_name ?? null,
    };

    // メタデータから commitHash を読み込む
    try {
      const metadataContent = await fs.readFile(this.metadataPath(executionId), 'utf-8');
      const metadata = ExecutionMetadataSchema.parse(JSON.parse(metadataContent));
      execution.commitHash = metadata.commitHash;
    } catch (e) {
      if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
        throw e;
      }

      // メタデータがない場合は古いメタデータから読み混んでみる
      // FIXME: 将来的に削除する
      try {
        const metadataContent = await fs.readFile(
          path.join(
            this.workspaceRoot,
            '.pahcer-ui',
            'results',
            `result_${executionId}`,
            'meta.json',
          ),
          'utf-8',
        );
        const metadata = ExecutionMetadataSchema.parse(JSON.parse(metadataContent));
        execution.commitHash = metadata.commitHash;
      } catch {
        // 古いメタデータもない場合は commitHash を設定しない
      }
    }

    return execution;
  }

  async findAll(): Promise<Execution[]> {
    const jsonDir = path.join(this.workspaceRoot, 'pahcer', 'json');
    if (!existsSync(jsonDir)) {
      return [];
    }

    const files = (await fs.readdir(jsonDir))
      .filter((f) => f.startsWith('result_') && f.endsWith('.json'))
      .sort()
      .reverse();

    const executionIds = files.map((file) => file.replace(/^result_(.+)\.json$/, '$1'));

    const results = await Promise.all(executionIds.map((id) => this.findById(id)));
    return results.filter((execution): execution is Execution => execution !== undefined);
  }

  async upsert(execution: Execution): Promise<void> {
    // result.json をまず読み混んで更新する
    const resultPath = this.resultPath(execution.id);
    const existingResult = await fs.readFile(resultPath, 'utf-8');
    const result = ResultJsonSchema.parse(JSON.parse(existingResult));
    result.start_time = execution.startTime.format('YYYY-MM-DD HH:mm:ss');
    result.comment = execution.comment;
    result.tag_name = execution.tagName;
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');

    // meta/execution.json を書き込む
    const metadataPath = this.metadataPath(execution.id);
    const metadata = {
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
