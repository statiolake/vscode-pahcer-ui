/**
 * 提出ランク（Rank / SubRank）を計算するドメインサービス
 */
export namespace SubmissionRankCalculator {
  export type SubmissionLike = {
    id: string;
    cases: Array<{ seed: number; score: number }>;
  };

  /**
   * 複数のシード集合が完全に一致するか判定する
   */
  export function haveIdenticalSeedSets(seedSets: number[][]): boolean {
    if (seedSets.length <= 1) {
      return true;
    }

    const firstKey = seedSetKey(seedSets[0]);
    for (let i = 1; i < seedSets.length; i++) {
      if (seedSetKey(seedSets[i]) !== firstKey) {
        return false;
      }
    }

    return true;
  }

  /**
   * 指定シード集合における各提出のスコア合計を計算する
   *
   * @param submissions ランキング対象の提出配列
   * @param seeds 対象シード番号
   * @returns 提出 ID => スコア合計
   */
  export function calculateTotalScores(
    submissions: SubmissionLike[],
    seeds: Iterable<number>,
  ): Map<string, number> {
    const seedSet = new Set(seeds);
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

  /**
   * 全シードでの Rank と、共通フィルター後シードでの SubRank を計算する
   *
   * SubRank は選択中提出のフィルター後シード集合が一致する場合のみ算出する。
   * 一致しない場合は SubRank マップの値は設定されない（表示側で '-' とする）。
   */
  export function computeRankMaps({
    rankingPool,
    allSeeds,
    filteredSeedsPerSelectedResult,
    objective,
  }: {
    rankingPool: SubmissionLike[];
    allSeeds: number[];
    filteredSeedsPerSelectedResult: number[][];
    objective: 'max' | 'min';
  }): {
    rank: Map<string, number>;
    subRank: Map<string, number> | undefined;
  } {
    const rank = rankByScores(calculateTotalScores(rankingPool, allSeeds), objective);

    if (!haveIdenticalSeedSets(filteredSeedsPerSelectedResult)) {
      return { rank, subRank: undefined };
    }

    const filteredSeeds = filteredSeedsPerSelectedResult[0] ?? [];
    const subRank = rankByScores(calculateTotalScores(rankingPool, filteredSeeds), objective);

    return { rank, subRank };
  }

  function seedSetKey(seeds: number[]): string {
    return [...seeds].sort((a, b) => a - b).join(',');
  }
}
