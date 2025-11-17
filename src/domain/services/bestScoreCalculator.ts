import type { TestCase } from '../models/testCase';

export namespace BestScoreCalculator {
  /**
   * テストケースから seed ごとのベストスコアを計算する
   *
   * @param testCases テストケース配列
   * @param objective 最適化の方向（'max'=最大化, 'min'=最小化）
   * @returns seed => ベストスコア のマップ
   */
  export function calculate(testCases: TestCase[], objective: 'max' | 'min'): Map<number, number> {
    const bestScores = new Map<number, number>();

    // seed ごとにグループ化
    const seedMap = new Map<number, TestCase[]>();
    for (const tc of testCases) {
      const existing = seedMap.get(tc.id.seed) || [];
      seedMap.set(tc.id.seed, [...existing, tc]);
    }

    // 各 seed のベストスコアを計算
    for (const [seed, cases] of seedMap.entries()) {
      let bestScore: number | null = null;

      for (const tc of cases) {
        if (tc.score > 0) {
          // WA（スコア0以下）は除外
          if (bestScore === null) {
            bestScore = tc.score;
          } else {
            if (objective === 'max' && tc.score > bestScore) {
              bestScore = tc.score;
            } else if (objective === 'min' && tc.score < bestScore) {
              bestScore = tc.score;
            }
          }
        }
      }

      if (bestScore !== null) {
        bestScores.set(seed, bestScore);
      }
    }

    return bestScores;
  }
}
