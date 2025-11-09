import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * pahcer の設定ファイルそのものを管理するリポジトリ
 *
 * 内容を管理するのは PahcerConfigRepository
 */
export class PahcerConfigFileRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * pahcer_config.tomlが存在するかチェック
	 */
	exists(): boolean {
		return fs.existsSync(this.getConfigPath());
	}

	/**
	 * pahcer_config.tomlを読み込む
	 */
	read(): string {
		const configPath = this.getConfigPath();
		if (!fs.existsSync(configPath)) {
			throw new Error(`pahcer_config.toml not found: ${configPath}`);
		}
		return fs.readFileSync(configPath, 'utf-8');
	}

	/**
	 * 一時設定ファイルを作成
	 *
	 * @param content - 設定ファイルの内容
	 * @returns 作成された一時ファイルのパス
	 */
	createTempConfig(content: string): string {
		const tempDir = path.join(this.workspaceRoot, '.pahcer-ui');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const tempConfigPath = path.join(tempDir, 'temp_pahcer_config.toml');
		fs.writeFileSync(tempConfigPath, content, 'utf-8');

		return tempConfigPath;
	}

	/**
	 * pahcer_config.tomlのパスを取得
	 */
	private getConfigPath(): string {
		return path.join(this.workspaceRoot, 'pahcer_config.toml');
	}
}
