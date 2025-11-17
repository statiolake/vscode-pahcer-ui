import type { TestCase } from '../models/testCase';

export namespace SeedStatsCalculator {
  /**
   * Seed別の統計情報
   */
  export interface SeedStats {
    seed: number;
    testCases: TestCase[];
    bestScore: number | null;
    count: number;
    averageScore: number;
    maxExecutionTime: number;
  }

  /**
   * Seed別の統計を計算する（ベストスコアも含む）
   *
   * @param testCases テストケース配列
   * @param bestScores seed => ベストスコア のマップ
   * @returns seed => 統計情報（ベストスコア含む）のマップ
   */
  export function calculate(
    testCases: TestCase[],
    bestScores: Map<number, number>,
  ): Map<number, SeedStats> {
    const seedMap = new Map<number, TestCase[]>();

    // seed ごとにテストケースをグループ化
    for (const testCase of testCases) {
      const existing = seedMap.get(testCase.id.seed) || [];
      seedMap.set(testCase.id.seed, [...existing, testCase]);
    }

    const statsMap = new Map<number, SeedStats>();

    // 各 seed の統計を計算
    for (const [seed, cases] of seedMap.entries()) {
      let totalScore = 0;
      let maxExecutionTime = 0;

      const bestScore = bestScores.get(seed) ?? null;

      for (const tc of cases) {
        totalScore += tc.score;
        if (tc.executionTime > maxExecutionTime) {
          maxExecutionTime = tc.executionTime;
        }
      }

      statsMap.set(seed, {
        seed,
        testCases: cases,
        bestScore,
        count: cases.length,
        averageScore: cases.length > 0 ? totalScore / cases.length : 0,
        maxExecutionTime,
      });
    }

    return statsMap;
  }
}
