import type { Execution } from '../models/execution';

/**
 * テスト実行のリポジトリインターフェース
 * pahcer が出力する result.json と meta/execution.json を読み書きする
 * テストケースは ITestCaseRepository が負責
 */
export interface IExecutionRepository {
  /**
   * ID で単一実行を取得
   * @returns Execution または undefined（存在しない場合）
   */
  findById(executionId: string): Promise<Execution | undefined>;

  /**
   * すべての実行を取得
   * @returns Execution 配列（存在しない場合は空配列）
   */
  findAll(): Promise<Execution[]>;

  /**
   * Execution を保存または更新
   */
  upsert(execution: Execution): Promise<void>;
}
