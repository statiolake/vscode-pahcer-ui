import type { PahcerConfigFileRepository } from './pahcerConfigFileRepository';

/**
 * pahcer_config.tomlから読み込んだ設定
 */
export interface PahcerConfig {
	/** 最適化の方向 ('max'=最大化, 'min'=最小化) */
	objective: 'max' | 'min';
}

/**
 * pahcer設定リポジトリ * pahcer_config.tomlから問題の最適化方向を読み込む
 */
export class PahcerConfigRepository {
	constructor(private pahcerConfigFileRepository: PahcerConfigFileRepository) {}

	/**
	 * pahcer_config.tomlから設定を読み込む
	 * ファイルが見つからない場合や解析に失敗した場合はエラーを throw
	 *
	 * @returns 設定オブジェクト
	 * @throws ファイルが見つからない、または objective が見つからない場合
	 */
	async loadConfig(): Promise<PahcerConfig> {
		// ConfigFileRepository を使ってファイルを読み込む
		const content = this.pahcerConfigFileRepository.read();
		const objective = this.parseObjective(content);

		return { objective };
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
		throw new Error('objective field not found in pahcer_config.toml');
	}
}
