import type { BestScoreCalculator } from './bestScoreCalculator';

/**
 * Best 判定のランキング対象を計算するドメインサービス
 */
export namespace BestRankingCalculator {
  export type ExecutionLike = {
    id: string;
    comment: string;
    cases: { seed: number; score: number }[];
  };

  /**
   * コメントの部分一致でランキング対象の提出を絞り込む
   *
   * @param executions 全提出
   * @param includePattern 含めるコメント（空欄の場合は制限なし）
   * @param excludePattern 除外するコメント（空欄の場合は制限なし）
   */
  export function filterByComment(
    executions: ExecutionLike[],
    includePattern: string,
    excludePattern: string,
  ): ExecutionLike[] {
    const include = includePattern.trim();
    const exclude = excludePattern.trim();

    return executions.filter((exec) => {
      if (include !== '' && !exec.comment.includes(include)) {
        return false;
      }
      if (exclude !== '' && exec.comment.includes(exclude)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 提出配列を BestScoreCalculator 用のフラットなテストケース配列に変換する
   */
  export function toFlatTestCases(executions: ExecutionLike[]): BestScoreCalculator.CaseLike[] {
    const cases: BestScoreCalculator.CaseLike[] = [];
    for (const exec of executions) {
      for (const testCase of exec.cases) {
        cases.push({ id: { seed: testCase.seed }, score: testCase.score });
      }
    }
    return cases;
  }

  /**
   * seed ごとにベストスコアを達成した提出数を数える
   */
  export function countBestAchieversPerSeed(
    executions: ExecutionLike[],
    bestScores: Map<number, number>,
  ): Map<number, number> {
    const counts = new Map<number, number>();

    for (const exec of executions) {
      for (const testCase of exec.cases) {
        const bestScore = bestScores.get(testCase.seed);
        if (bestScore !== undefined && testCase.score === bestScore && testCase.score > 0) {
          counts.set(testCase.seed, (counts.get(testCase.seed) ?? 0) + 1);
        }
      }
    }

    return counts;
  }
}
