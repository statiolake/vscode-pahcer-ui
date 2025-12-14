import type { Execution } from '../models/execution';
import type { TestCase } from '../models/testCase';

/**
 * ソート順の型定義
 */
export type SeedSortOrder =
  | 'executionAsc'
  | 'executionDesc'
  | 'absoluteScoreAsc'
  | 'absoluteScoreDesc';

export namespace SeedExecutionSorter {
  /**
   * Seed別の実行結果をソートする（純粋関数）
   *
   * @param executions 実行結果配列
   * @param order ソート順
   * @returns ソート済み実行結果配列
   */
  export function byOrder<T extends { execution: Execution; testCase: TestCase }>(
    executions: T[],
    order: SeedSortOrder,
  ): T[] {
    const sorted = [...executions];

    switch (order) {
      case 'executionAsc':
        sorted.sort((a, b) => a.execution.id.localeCompare(b.execution.id));
        break;
      case 'executionDesc':
        sorted.sort((a, b) => b.execution.id.localeCompare(a.execution.id));
        break;
      case 'absoluteScoreAsc':
        sorted.sort((a, b) => a.testCase.score - b.testCase.score);
        break;
      case 'absoluteScoreDesc':
        sorted.sort((a, b) => b.testCase.score - a.testCase.score);
        break;
    }

    return sorted;
  }
}
