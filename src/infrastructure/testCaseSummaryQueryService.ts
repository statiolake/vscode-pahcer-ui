import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TreeViewTestCaseSummary } from '../application/dtos/pahcerTreeData';
import type { ITestCaseSummaryQueryService } from '../application/queryServices/testCaseSummaryQueryService';
import { TestCaseId } from '../domain/models/testCase';
import { asErrnoException } from '../util/lang';
import { ResultJsonSchema } from './schemas';

/**
 * テストケースサマリーのクエリサービス
 */
export class TestCaseSummaryQueryService implements ITestCaseSummaryQueryService {
  constructor(private workspaceRoot: string) {}

  async findByExecutionId(executionId: string): Promise<TreeViewTestCaseSummary[]> {
    const jsonPath = path.join(this.workspaceRoot, 'pahcer', 'json', `result_${executionId}.json`);

    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const raw = ResultJsonSchema.parse(JSON.parse(content));

      return (raw.cases ?? []).map(
        (c) =>
          new TreeViewTestCaseSummary(
            new TestCaseId(executionId, c.seed),
            c.score,
            c.execution_time,
            c.error_message,
          ),
      );
    } catch (e) {
      if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
        throw e;
      }
      return [];
    }
  }
}
