import type { TestCaseId } from './testCase';

/**
 * TreeView の集計表示に必要な最小限のテストケース情報
 */
export class SummaryTestCase {
  constructor(
    /** ID */
    public readonly id: TestCaseId,
    /** スコア（0以下の場合は WA） */
    public readonly score: number,
    /** 実行時間（秒） */
    public readonly executionTime: number,
    /** エラーメッセージ */
    public readonly errorMessage: string,
  ) {}
}
