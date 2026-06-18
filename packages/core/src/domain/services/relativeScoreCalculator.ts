export namespace RelativeScoreCalculator {
  /**
   * 実スコアとベストスコアから相対スコアを計算する
   *
   * @param score 実スコア
   * @param bestScore ベストスコア
   * @param objective 最適化の方向（'max'=最大化, 'min'=最小化）
   * @returns 相対スコア（パーセンテージ、0-100+）、無効な場合は 0
   */
  export function calculate(
    score: number,
    bestScore: number | undefined,
    objective: 'max' | 'min',
  ): number {
    if (score <= 0 || bestScore === undefined || bestScore <= 0) {
      return 0;
    }

    if (objective === 'max') {
      return (score / bestScore) * 100;
    } else {
      return (bestScore / score) * 100;
    }
  }

  /**
   * 複数のスコアについて相対スコアを一括計算する
   *
   * @param scores 計算対象のスコア配列
   * @param bestScore ベストスコア
   * @param objective 最適化の方向（'max' | 'min'）
   * @returns スコア => 相対スコア のマップ
   */
  export function calculateMultiple(
    scores: number[],
    bestScore: number | undefined,
    objective: 'max' | 'min',
  ): Map<number, number> {
    const result = new Map<number, number>();
    for (const score of scores) {
      result.set(score, calculate(score, bestScore, objective));
    }
    return result;
  }
}
