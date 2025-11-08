/**
 * 相対スコア計算サービス
 * pahcer本体と同じロジックで相対スコアを計算する
 *
 * 相対スコアの意義:
 * - 初回実行時のスコアを参照スコア(ベストスコア)とし、以降の実行結果を相対的に評価
 * - 問題の難易度に依存しない、改善度を示す指標
 */

/**
 * 最適化の方向
 */
export type Objective = 'max' | 'min';

/**
 * 相対スコアを計算する（pahcer本体と同じロジック）
 *
 * @param currentScore 現在のスコア
 * @param referenceScore 参照スコア(ベストスコア)
 * @param objective 最適化の方向('max'=最大化, 'min'=最小化)
 * @returns 相対スコア(%)
 */
export function calculateRelativeScore(
	currentScore: number,
	referenceScore: number | null | undefined,
	objective: Objective,
): number {
	// 参照スコアがない場合は0%を返す
	if (!referenceScore || referenceScore <= 0 || currentScore <= 0) {
		return 0.0;
	}

	switch (objective) {
		case 'max':
			// 最大化問題: (currentScore / referenceScore) * 100
			return (currentScore / referenceScore) * 100.0;
		case 'min':
			// 最小化問題: (referenceScore / currentScore) * 100
			return (referenceScore / currentScore) * 100.0;
		default:
			// このような objective は存在しないはずなので、never でコンパイル時検査する
			return ((_: never) => {
				throw Error('unknown objective');
			})(objective);
	}
}

/**
 * seed別のベストスコアを使用して、複数のスコアの相対スコアを一括計算する
 *
 * @param scores seed => score のマップ
 * @param bestScores seed => bestScore のマップ
 * @param objective 最適化の方向
 * @returns seed => relativeScore のマップ
 */
export function calculateRelativeScoresForSeeds(
	scores: Map<number, number>,
	bestScores: Map<number, number>,
	objective: Objective,
): Map<number, number> {
	const result = new Map<number, number>();

	for (const [seed, score] of scores.entries()) {
		const bestScore = bestScores.get(seed);
		const relativeScore = calculateRelativeScore(score, bestScore, objective);
		result.set(seed, relativeScore);
	}

	return result;
}
