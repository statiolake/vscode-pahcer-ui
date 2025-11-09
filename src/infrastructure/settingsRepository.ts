import { ConfigFileRepository } from './configFileRepository';

/**
 * pahcer_config.tomlから読み込んだ設定
 */
export interface PahcerSettings {
	/** 最適化の方向 ('max'=最大化, 'min'=最小化) */
	objective: 'max' | 'min';
}

/**
 * pahcer設定リポジトリ
 * pahcer_config.tomlから問題の最適化方向を読み込む
 */
export class SettingsRepository {
	private configFileRepository: ConfigFileRepository;

	constructor(workspaceRoot: string) {
		this.configFileRepository = new ConfigFileRepository(workspaceRoot);
	}

	/**
	 * pahcer_config.tomlから設定を読み込む
	 * ファイルが見つからない場合や解析に失敗した場合はエラーを throw
	 *
	 * @returns 設定オブジェクト
	 * @throws ファイルが見つからない、または objective が見つからない場合
	 */
	async loadSettings(): Promise<PahcerSettings> {
		try {
			// ConfigFileRepository を使ってファイルを読み込む
			const content = this.configFileRepository.read();
			const objective = this.parseObjective(content);

			return { objective };
		} catch (e) {
			throw new Error(
				`Failed to load pahcer_config.toml: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	/**
	 * TOMLコンテンツから objective フィールドを抽出
	 * TOML形式: objective = "max" | "min"
	 *
	 * @param content TOMLファイルの内容
	 * @returns 'max' または 'min'
	 * @throws objective が見つからない場合
	 */
	private parseObjective(content: string): 'max' | 'min' {
		// 簡易的なTOML解析: objective = "max" または objective = "min" を探す
		const match = content.match(/objective\s*=\s*['"](max|min)['"]/i);

		if (match && (match[1].toLowerCase() === 'max' || match[1].toLowerCase() === 'min')) {
			return match[1].toLowerCase() as 'max' | 'min';
		}

		// objective が見つからない場合はエラー
		throw new Error('objective field not found in pahcer.toml');
	}
}
