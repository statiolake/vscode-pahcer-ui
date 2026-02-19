import type { SummaryTestCase } from '../models/summaryTestCase';

/**
 * テストケース集計表示向けのクエリサービス
 * エンティティではなく参照専用の軽量データを返す
 */
export interface ITestCaseSummaryQueryService {
  /**
   * 指定された executionId のサマリー用テストケースを取得
   */
  findByExecutionId(executionId: string): Promise<SummaryTestCase[]>;
}
