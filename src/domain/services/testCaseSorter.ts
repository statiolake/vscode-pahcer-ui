import type { TestCase } from '../models/testCase';

export namespace TestCaseSorter {
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

  /**
   * テストケースをソートする（純粋関数）
   *
   * @param cases テストケース配列
   * @param order ソート順
   * @param relativeScores seed => 相対スコア のマップ（relativeScore ソート時に使用）
   * @returns ソート済みテストケース配列
   */
  export function byOrder(
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
}
