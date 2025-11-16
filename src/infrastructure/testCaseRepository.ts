import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TestCase, TestCaseId } from '../domain/models/testCase';
import { exists } from '../util/fs';
import { asErrnoException } from '../util/lang';
import type { InOutFilesAdapter } from './inOutFilesAdapter';
import {
  type ResultJsonCase,
  ResultJsonSchema,
  type TestCaseMetadata,
  TestCaseMetadataSchema,
} from './schemas';

/**
 * テストケースリポジトリ
 * TestCase の CRUD 操作を提供
 *
 * データソース:
 * - pahcer/json/result_${executionId}.json (実行結果の元データ)
 * - .pahcer-ui/results/result_${executionId}/meta/testcase_{seed}.json (解析データ)
 *
 * 識別方法:
 * - executionId と seed の複合キーで TestCase を一意に識別
 */
export class TestCaseRepository {
  constructor(
    private inOutFilesAdapter: InOutFilesAdapter,
    private workspaceRoot: string,
  ) {}

  /**
   * 指定された TestCase を1件取得
   * @returns TestCase または null（存在しない場合）
   */
  async findById(id: TestCaseId): Promise<TestCase | undefined> {
    const exectionJsonpath = this.getExecutionJsonPath(id.executionId);
    try {
      const content = await fs.readFile(exectionJsonpath, 'utf-8');
      const executionJson = ResultJsonSchema.parse(JSON.parse(content));
      // 該当する seed を検索
      const caseData = (executionJson.cases ?? []).find((c) => c.seed === id.seed);
      if (!caseData) {
        return undefined;
      }

      return this.buildTestCase(id.executionId, caseData);
    } catch (e) {
      if (e instanceof Error && asErrnoException(e).code === 'ENOENT') {
        return undefined;
      }
      console.error(`Failed to load execution JSON for ${id.executionId}:`, e);
      throw e;
    }
  }

  /**
   * 指定された executionId の全 TestCase を取得
   * @returns TestCase 配列（存在しない場合は空配列）
   */
  async findByExecutionId(executionId: string): Promise<TestCase[]> {
    const jsonPath = this.getExecutionJsonPath(executionId);

    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const raw = ResultJsonSchema.parse(JSON.parse(content));

      const testCases = await Promise.all(
        (raw.cases ?? []).map((c) => this.buildTestCase(executionId, c)),
      );
      return testCases;
    } catch (e) {
      if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
        throw e;
      }

      // ファイルが存在しない場合は空配列を返す
      return [];
    }
  }

  /**
   * TestCase のメタデータを保存
   */
  async upsert(testCase: TestCase): Promise<void> {
    // execution.json 部分は readonly なので変更されることはないと信じ、書き込まない
    // (書き込むと Pahcer 本体をを壊してしまう可能性もあるので)
    await this.upsertMetadata(testCase);
  }

  private async upsertMetadata(testCase: TestCase): Promise<void> {
    const metaPath = this.getMetaPath(testCase.id);
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    const metadata: TestCaseMetadata = {
      firstInputLine: testCase.firstInputLine,
      stderrVars: testCase.stderrVars,
    };
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * TestCase オブジェクトを構築
   */
  private async buildTestCase(executionId: string, caseData: ResultJsonCase): Promise<TestCase> {
    const id = new TestCaseId(executionId, caseData.seed);
    const foundOutput = await exists(this.inOutFilesAdapter.getArchivedPath('out', id));
    const testCase = new TestCase(
      id,
      caseData.score,
      caseData.execution_time,
      caseData.error_message,
      foundOutput,
    );

    // メタデータがあれば読み込む
    try {
      const metaPath = this.getMetaPath(id);
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata = TestCaseMetadataSchema.parse(JSON.parse(metaContent));
      testCase.firstInputLine = metadata.firstInputLine;
      testCase.stderrVars = metadata.stderrVars;
    } catch (e) {
      if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
        throw e;
      }

      // メタデータファイルが存在しない場合は古いメタデータから読み込んでみる
      // FIXME: 将来的に削除する
      try {
        const oldMetaContent = await fs.readFile(
          path.join(
            this.workspaceRoot,
            '.pahcer-ui',
            'results',
            `result_${executionId}`,
            'meta.json',
          ),
          'utf-8',
        );
        const oldMeta = JSON.parse(oldMetaContent);
        testCase.firstInputLine = oldMeta.analysis[caseData.seed]?.firstInputLine;
        testCase.stderrVars = oldMeta.analysis[caseData.seed]?.stderrVars;
      } catch {
        // 古いメタデータもない場合は何もしない
      }
    }

    return testCase;
  }

  private getExecutionJsonPath(executionId: string): string {
    return path.join(this.workspaceRoot, 'pahcer', 'json', `result_${executionId}.json`);
  }

  /**
   * テストケースメタデータファイルのパスを取得
   */
  private getMetaPath(testCaseId: TestCaseId): string {
    const seedStr = String(testCaseId.seed).padStart(4, '0');
    return path.join(
      this.workspaceRoot,
      '.pahcer-ui',
      'results',
      `result_${testCaseId.executionId}`,
      'meta',
      `testcase_${seedStr}.json`,
    );
  }
}
