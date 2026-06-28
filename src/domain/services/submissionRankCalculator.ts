/**
 * テストケースフィルター適用後の提出ランクを計算するドメインサービス
 */
export namespace SubmissionRankCalculator {
  export type SubmissionLike = {
    id: string;
    cases: Array<{ seed: number; score: number }>;
  };

  /**
   * フィルター後のシード集合における各提出のスコア合計を計算する
   *
   * @param submissions ランキング対象の提出配列
   * @param filteredSeeds フィルター後に残ったシード番号
   * @returns 提出 ID => フィルター後スコア合計
   */
  export function calculateFilteredTotalScores(
    submissions: SubmissionLike[],
    filteredSeeds: Iterable<number>,
  ): Map<string, number> {
    const seedSet = new Set(filteredSeeds);
    const scores = new Map<string, number>();

    for (const submission of submissions) {
      let total = 0;
      for (const testCase of submission.cases) {
        if (seedSet.has(testCase.seed) && testCase.score > 0) {
          total += testCase.score;
        }
      }
      scores.set(submission.id, total);
    }

    return scores;
  }

  /**
   * スコア合計から競技ランキング（1, 2, 2, 4 ...）を算出する
   *
   * @param scores 提出 ID => スコア合計
   * @param objective 最適化の方向（'max'=高いほど上位, 'min'=低いほど上位）
   * @returns 提出 ID => ランク（1 始まり）
   */
  export function rankByScores(
    scores: Map<string, number>,
    objective: 'max' | 'min',
  ): Map<string, number> {
    const entries = [...scores.entries()];
    entries.sort((a, b) => (objective === 'max' ? b[1] - a[1] : a[1] - b[1]));

    const ranks = new Map<string, number>();
    let rank = 1;

    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i][1] !== entries[i - 1][1]) {
        rank = i + 1;
      }
      ranks.set(entries[i][0], rank);
    }

    return ranks;
  }
}
