import type { Execution } from '../models/execution';
import type { TestCase } from '../models/testCase';

/**
 * グルーピングモード
 */
export type GroupingMode = 'byExecution' | 'bySeed';

/**
 * ソート順の型定義
 */
export type ExecutionSortOrder =
  | 'seedAsc'
  | 'seedDesc'
  | 'relativeScoreAsc'
  | 'relativeScoreDesc'
  | 'absoluteScoreAsc'
  | 'absoluteScoreDesc';

export type SeedSortOrder =
  | 'executionAsc'
  | 'executionDesc'
  | 'absoluteScoreAsc'
  | 'absoluteScoreDesc';

/**
 * テストケースをソートする（純粋関数）
 * @param cases テストケース配列
 * @param order ソート順
 * @param relativeScores seed => 相対スコア のマップ（relativeScore ソート時に使用）
 */
export function sortTestCases(
  cases: TestCase[],
  order: ExecutionSortOrder,
  relativeScores?: Map<number, number>,
): TestCase[] {
  const sorted = [...cases];

  switch (order) {
    case 'seedAsc':
      sorted.sort((a, b) => a.id.seed - b.id.seed);
      break;
    case 'seedDesc':
      sorted.sort((a, b) => b.id.seed - a.id.seed);
      break;
    case 'relativeScoreAsc':
      if (relativeScores) {
        sorted.sort(
          (a, b) => (relativeScores.get(a.id.seed) ?? 0) - (relativeScores.get(b.id.seed) ?? 0),
        );
      }
      break;
    case 'relativeScoreDesc':
      if (relativeScores) {
        sorted.sort(
          (a, b) => (relativeScores.get(b.id.seed) ?? 0) - (relativeScores.get(a.id.seed) ?? 0),
        );
      }
      break;
    case 'absoluteScoreAsc':
      sorted.sort((a, b) => a.score - b.score);
      break;
    case 'absoluteScoreDesc':
      sorted.sort((a, b) => b.score - a.score);
      break;
  }

  return sorted;
}

/**
 * Seed別の実行結果をソートする（純粋関数）
 */
export function sortExecutionsForSeed<T extends { execution: Execution; testCase: TestCase }>(
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
