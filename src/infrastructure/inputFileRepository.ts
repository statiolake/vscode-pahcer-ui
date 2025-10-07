import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 入力ファイルのリポジトリ
 */
export class InputFileRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 入力ファイルのパスを取得
	 */
	getInputPath(seed: number): string {
		return path.join(this.workspaceRoot, 'tools', 'in', `${String(seed).padStart(4, '0')}.txt`);
	}

	/**
	 * 入力ファイルを読み込む
	 */
	async load(seed: number): Promise<string | null> {
		const inputPath = this.getInputPath(seed);

		if (!fs.existsSync(inputPath)) {
			return null;
		}

		try {
			return fs.readFileSync(inputPath, 'utf-8');
		} catch (e) {
			console.error(`Failed to read input file for seed ${seed}:`, e);
			return null;
		}
	}

	/**
	 * 入力ファイルの最初の行を読み込む
	 */
	async loadFirstLine(seed: number): Promise<string | null> {
		const content = await this.load(seed);
		if (!content) {
			return null;
		}

		const firstLine = content.split('\n')[0].trim();
		return firstLine;
	}

	/**
	 * 複数のSeedに対して最初の行を一括読み込み
	 */
	async loadFirstLines(seeds: number[]): Promise<Map<number, string>> {
		const result = new Map<number, string>();

		for (const seed of seeds) {
			const firstLine = await this.loadFirstLine(seed);
			if (firstLine) {
				result.set(seed, firstLine);
			}
		}

		return result;
	}
}
