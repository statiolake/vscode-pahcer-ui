import type { TestCase, TestCaseId } from '../models/testCase';

/**
 * テストケースリポジトリインターフェース
 * TestCase の CRUD 操作を提供
 *
 * データソース:
 * - pahcer/json/result_${executionId}.json (実行結果の元データ)
 * - .pahcer-ui/results/result_${executionId}/meta/testcase_{seed}.json (解析データ)
 *
 * 識別方法:
 * - executionId と seed の複合キーで TestCase を一意に識別
 */
export interface ITestCaseRepository {
  /**
   * 指定された TestCase を1件取得
   * @returns TestCase または undefined（存在しない場合）
   */
  findById(id: TestCaseId): Promise<TestCase | undefined>;

  /**
   * 指定された executionId の全 TestCase を取得
   * @returns TestCase 配列（存在しない場合は空配列）
   */
  findByExecutionId(executionId: string): Promise<TestCase[]>;

  /**
   * TestCase のメタデータを保存
   */
  upsert(testCase: TestCase): Promise<void>;
}
