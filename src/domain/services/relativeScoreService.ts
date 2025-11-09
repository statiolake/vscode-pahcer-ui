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
 * @param referenceScore 参照スコア(ベストスコア)。nullの場合は初回実行と見なす
 * @param objective 最適化の方向('max'=最大化, 'min'=最小化)
 * @returns 相対スコア(%)。WA（currentScore <= 0）の場合は0%、参照スコアなしで AC の場合は100%
 */
export function calculateRelativeScore(
	currentScore: number,
	referenceScore: number | null | undefined,
	objective: Objective,
): number {
	console.log(
		`Calculating relative score: currentScore=${currentScore}, referenceScore=${referenceScore}, objective=${objective}`,
	);

	// WA（スコア0以下）の場合は0%を返す
	if (currentScore <= 0) {
		return 0.0;
	}

	// 参照スコアがない場合は100%を返す（初回実行時の AC）
	if (!referenceScore || referenceScore <= 0) {
		return 100.0;
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
