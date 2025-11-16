import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_UI_CONFIG, type UIConfig } from '../domain/models/uiConfig';
import { UIConfigSchema } from './schemas';

/**
 * 比較設定のリポジトリ
 */
export class UIConfigRepository {
	private configDirPath: string;
	private configPath: string;

	constructor(workspaceRoot: string) {
		this.configDirPath = path.join(workspaceRoot, '.pahcer-ui');
		this.configPath = path.join(this.configDirPath, 'config.json');
	}

	/**
	 * 設定を読み込む
	 */
	async load(): Promise<UIConfig> {
		let content: string;
		try {
			content = await fs.readFile(this.configPath, { encoding: 'utf-8' });
		} catch {
			// ファイルが存在しない場合
			return { ...DEFAULT_UI_CONFIG };
		}

		const loaded = UIConfigSchema.parse(JSON.parse(content));
		return {
			...DEFAULT_UI_CONFIG,
			...loaded,
		};
	}

	/**
	 * 設定を保存する
	 */
	async save(config: UIConfig): Promise<void> {
		await fs.mkdir(this.configDirPath, { recursive: true });
		await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
	}
}
