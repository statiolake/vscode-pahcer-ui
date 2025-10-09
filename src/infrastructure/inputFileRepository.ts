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
}
