import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * best_scores.jsonから読み込んだ生データの型
 * pahcer が出力する形式: { "seed番号": スコア, ... }
 */
interface RawBestScores {
	[seed: string]: number;
}

/**
 * best_scores.jsonリポジトリ
 * pahcer/best_scores.jsonから過去のベストスコアを読み込む
 */
export class BestScoresRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * best_scores.jsonを読み込み、Map<seed, bestScore>で返す
	 *
	 * @returns seed => ベストスコア のマップ（ファイルがない場合は空のマップ）
	 */
	async loadBestScores(): Promise<Map<number, number>> {
		const bestScoresPath = path.join(this.workspaceRoot, 'pahcer', 'best_scores.json');

		// ファイルが存在しない場合は空のマップを返す
		if (!fs.existsSync(bestScoresPath)) {
			console.warn(`[BestScoresRepository] File not found: ${bestScoresPath}`);
			return new Map();
		}

		try {
			const content = fs.readFileSync(bestScoresPath, 'utf-8');
			const raw: RawBestScores = JSON.parse(content);

			const bestScores = new Map<number, number>();

			// キーが数値の文字列なので、数値に変換
			for (const [seedStr, score] of Object.entries(raw)) {
				const seed = Number(seedStr);
				if (!Number.isNaN(seed) && typeof score === 'number' && score > 0) {
					bestScores.set(seed, score);
				}
			}

			console.log(
				`[BestScoresRepository] Loaded ${bestScores.size} best scores from ${bestScoresPath}`,
			);

			return bestScores;
		} catch (e) {
			console.error(`Failed to load best_scores.json: ${e}`);
			return new Map();
		}
	}
}
