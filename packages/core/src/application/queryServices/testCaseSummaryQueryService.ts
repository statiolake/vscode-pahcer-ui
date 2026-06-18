import type { TreeViewTestCaseSummary } from '../dtos/pahcerTreeData';

/**
 * TreeView 表示ユースケース向けの軽量テストケース取得 port。
 */
export interface ITestCaseSummaryQueryService {
  /**
   * 指定された executionId のサマリー用テストケースを取得する。
   */
  findByExecutionId(executionId: string): Promise<TreeViewTestCaseSummary[]>;
}
