/**
 * 数式評価サービス（比較モード用）
 * シンプルな数式（四則演算、log, sqrt等）を評価する
 */

/**
 * 変数マップから数式を評価する（純粋関数）
 */
export function evaluateExpression(
	expression: string,
	variables: Record<string, number>,
): number | null {
	try {
		// 安全のため、許可された文字のみを通す
		if (!/^[0-9a-zA-Z\s+\-*/().log,sqrt]+$/.test(expression)) {
			return null;
		}

		// 変数を置き換え
		let replaced = expression;
		for (const [key, value] of Object.entries(variables)) {
			const regex = new RegExp(`\\b${key}\\b`, 'g');
			replaced = replaced.replace(regex, String(value));
		}

		// log, sqrt を Math.log, Math.sqrt に置き換え
		replaced = replaced.replace(/\blog\(/g, 'Math.log(');
		replaced = replaced.replace(/\bsqrt\(/g, 'Math.sqrt(');

		// eval は危険だが、ここでは許可された文字のみを通しているので許容
		// biome-ignore lint/security/noGlobalEval: ドメイン層で数式評価が必要
		const result = eval(replaced);

		if (typeof result === 'number' && !Number.isNaN(result)) {
			return result;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * 入力の最初の行からフィーチャーを抽出する（純粋関数）
 */
export function extractFeatures(firstLine: string, featureNames: string[]): Record<string, number> {
	const values = firstLine.trim().split(/\s+/).map(Number);
	const features: Record<string, number> = {};

	for (let i = 0; i < featureNames.length && i < values.length; i++) {
		if (!Number.isNaN(values[i])) {
			features[featureNames[i]] = values[i];
		}
	}

	return features;
}
