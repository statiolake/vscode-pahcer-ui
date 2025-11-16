import type { TestCase } from '../models/testCase';

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
export function calculateSeedStats(
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

/**
 * テストケースから seed ごとのベストスコアを計算する
 *
 * @param testCases テストケース配列
 * @param objective 最適化の方向（'max'=最大化, 'min'=最小化）
 * @returns seed => ベストスコア のマップ
 */
export function calculateBestScoresFromTestCases(
  testCases: TestCase[],
  objective: 'max' | 'min',
): Map<number, number> {
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
