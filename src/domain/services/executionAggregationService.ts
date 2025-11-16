import type { Execution } from '../models/execution';
import type { TestCase } from '../models/testCase';

/**
 * 実行ごとの集計情報
 */
export interface ExecutionStats {
  execution: Execution;
  testCases: TestCase[];
  caseCount: number;
  totalScore: number;
  maxExecutionTime: number;
  waSeeds: number[];
  acCount: number;
  averageScore: number;
  averageRelativeScore: number;
}

/**
 * テストケースを実行ごとに集計する
 *
 * @param executions 実行のメタデータ配列
 * @param testCases すべてのテストケース
 * @param bestScores seed => ベストスコア のマップ
 * @param objective 最適化の方向（'max'=最大化, 'min'=最小化）
 * @returns 実行ごとの集計情報
 */
export function aggregateByExecution(
  executions: Execution[],
  testCases: TestCase[],
  bestScores: Map<number, number>,
  objective: 'max' | 'min',
): ExecutionStats[] {
  return executions.map((execution) => {
    // この実行に属するテストケースを取得
    const executionTestCases = testCases.filter((tc) => tc.id.executionId === execution.id);

    // 統計を計算
    let totalScore = 0;
    let maxExecutionTime = 0;
    let totalRelativeScore = 0;
    const waSeeds: number[] = [];

    for (const tc of executionTestCases) {
      totalScore += tc.score;
      maxExecutionTime = Math.max(maxExecutionTime, tc.executionTime);

      if (tc.score <= 0) {
        waSeeds.push(tc.id.seed);
      } else {
        // 相対スコアを計算
        const bestScore = bestScores.get(tc.id.seed);
        if (bestScore !== undefined) {
          if (objective === 'max') {
            totalRelativeScore += (tc.score / bestScore) * 100;
          } else {
            totalRelativeScore += (bestScore / tc.score) * 100;
          }
        } else {
          totalRelativeScore += 100;
        }
      }
    }

    const caseCount = executionTestCases.length;
    const acCount = caseCount - waSeeds.length;

    return {
      execution,
      testCases: executionTestCases,
      caseCount,
      totalScore,
      maxExecutionTime,
      waSeeds,
      acCount,
      averageScore: caseCount > 0 ? totalScore / caseCount : 0,
      averageRelativeScore: caseCount > 0 ? totalRelativeScore / caseCount : 0,
    };
  });
}
