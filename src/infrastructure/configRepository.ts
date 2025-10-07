import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	type ComparisonConfig,
	DEFAULT_COMPARISON_CONFIG,
} from '../domain/models/comparisonConfig';

/**
 * 比較設定のリポジトリ
 */
export class ConfigRepository {
	private configPath: string;

	constructor(workspaceRoot: string) {
		const configDir = path.join(workspaceRoot, '.pahcer-ui');
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}
		this.configPath = path.join(configDir, 'config.json');
	}

	/**
	 * 設定を読み込む
	 */
	async load(): Promise<ComparisonConfig> {
		if (fs.existsSync(this.configPath)) {
			try {
				const content = fs.readFileSync(this.configPath, 'utf-8');
				const loaded = JSON.parse(content);
				// Merge with defaults to handle missing keys
				return {
					...DEFAULT_COMPARISON_CONFIG,
					...loaded,
				};
			} catch (e) {
				console.error('Failed to load config:', e);
			}
		}
		return { ...DEFAULT_COMPARISON_CONFIG };
	}

	/**
	 * 設定を保存する
	 */
	async save(config: ComparisonConfig): Promise<void> {
		try {
			fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
		} catch (e) {
			console.error('Failed to save config:', e);
			throw e;
		}
	}
}
