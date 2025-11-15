import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type ConfigId, PahcerConfig } from '../domain/models/configFile';

/**
 * pahcer 設定ファイル（pahcer_config.toml）リポジトリ
 *
 * 責務:
 * - TOML ファイルの読み込み/書き込み
 * - TOML コンテンツから start_seed, end_seed, objective をパース
 * - PahcerConfig ドメインモデルへの変換
 */
export class PahcerConfigRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * 指定されたファイルを読み込み、PahcerConfig に変換
	 * temporary の場合、通常ファイルから一時ファイルを作成してコピー
	 */
	async get(id: ConfigId): Promise<PahcerConfig> {
		const normalPath = this.getNormalPath();
		const configPath = this.getPath(id);

		// temporary の場合、通常ファイルから一時ファイルを作成
		if (id === 'temporary') {
			const tempDir = path.dirname(configPath);
			await fs.mkdir(tempDir, { recursive: true });
			const normalContent = await fs.readFile(normalPath, 'utf-8');
			await fs.writeFile(configPath, normalContent, 'utf-8');
		}

		const content = await fs.readFile(configPath, 'utf-8');

		// TOML コンテンツから start_seed/end_seed/objective をパース
		const startSeed = this.extractStartSeed(content);
		const endSeed = this.extractEndSeed(content);
		const objective = this.extractObjective(content);

		return new PahcerConfig(id, configPath, startSeed, endSeed, objective);
	}

	/**
	 * PahcerConfig をファイルに保存
	 * config.path に指定されているパスに保存
	 */
	async save(config: PahcerConfig): Promise<void> {
		const currentContent = await fs.readFile(config.path, 'utf-8');

		// 現在のコンテンツに start_seed/end_seed を反映させる
		let newContent = currentContent;
		newContent = this.replaceStartSeed(newContent, config.startSeed);
		newContent = this.replaceEndSeed(newContent, config.endSeed);

		// 必要なディレクトリを作成
		const dir = path.dirname(config.path);
		await fs.mkdir(dir, { recursive: true });

		await fs.writeFile(config.path, newContent, 'utf-8');
	}

	/**
	 * 指定された id のファイルを削除
	 */
	async delete(id: ConfigId): Promise<void> {
		if (id === 'normal') {
			// normal ファイルは削除しない
			throw new Error('Cannot delete normal config file');
		}

		const configPath = this.getPath(id);
		try {
			await fs.unlink(configPath);
		} catch {
			// ファイルがない場合は無視
		}
	}

	/**
	 * TOML コンテンツから start_seed の値をパース
	 */
	private extractStartSeed(content: string): number {
		const match = content.match(/^start_seed\s*=\s*(\d+)/m);
		return match ? parseInt(match[1], 10) : 0;
	}

	/**
	 * TOML コンテンツから end_seed の値をパース
	 */
	private extractEndSeed(content: string): number {
		const match = content.match(/^end_seed\s*=\s*(\d+)/m);
		return match ? parseInt(match[1], 10) : 0;
	}

	/**
	 * TOML コンテンツから objective の値をパース
	 */
	private extractObjective(content: string): 'max' | 'min' {
		const match = content.match(/objective\s*=\s*['"](max|min)['"]/i);

		if (match && (match[1].toLowerCase() === 'max' || match[1].toLowerCase() === 'min')) {
			return match[1].toLowerCase() as 'max' | 'min';
		}

		// objective が見つからない場合はデフォルト値を返す
		return 'max';
	}

	/**
	 * TOML コンテンツの start_seed を置換
	 * start_seed は必ず存在する前提
	 */
	private replaceStartSeed(content: string, value: number): string {
		const regex = /^(start_seed\s*=\s*)\d+/m;
		return content.replace(regex, `$1${value}`);
	}

	/**
	 * TOML コンテンツの end_seed を置換
	 * end_seed は必ず存在する前提
	 */
	private replaceEndSeed(content: string, value: number): string {
		const regex = /^(end_seed\s*=\s*)\d+/m;
		return content.replace(regex, `$1${value}`);
	}

	/**
	 * normal ファイルのパスを取得
	 */
	private getNormalPath(): string {
		return path.join(this.workspaceRoot, 'pahcer_config.toml');
	}

	/**
	 * 指定された id のファイルパスを取得
	 */
	private getPath(id: ConfigId): string {
		switch (id) {
			case 'normal':
				return this.getNormalPath();
			case 'temporary':
				return path.join(this.workspaceRoot, '.pahcer-ui', 'temp_pahcer_config.toml');
		}
	}
}
