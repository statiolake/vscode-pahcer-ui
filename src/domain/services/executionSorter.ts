import type { Execution } from '../models/execution';

export namespace ExecutionSorter {
  /**
   * 実行を開始時刻の降順でソート（最新のものが最初）
   *
   * @param executions ソート対象の実行配列
   * @returns ソート済み配列（元の配列は変更しない）
   */
  export function byTimeDescending(executions: Execution[]): Execution[] {
    return [...executions].sort((a, b) => b.startTime.diff(a.startTime));
  }

  /**
   * 実行を開始時刻の昇順でソート（最古のものが最初）
   *
   * @param executions ソート対象の実行配列
   * @returns ソート済み配列（元の配列は変更しない）
   */
  export function byTimeAscending(executions: Execution[]): Execution[] {
    return [...executions].sort((a, b) => a.startTime.diff(b.startTime));
  }
}
