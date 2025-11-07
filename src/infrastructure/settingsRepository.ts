import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * pahcer.tomlから読み込んだ設定
 */
export interface PahcerSettings {
	/** 最適化の方向 ('max'=最大化, 'min'=最小化) */
	objective: 'max' | 'min';
}

/**
 * pahcer設定リポジトリ
 * pahcer.tomlから問題の最適化方向を読み込む
 */
export class SettingsRepository {
	constructor(private workspaceRoot: string) {}

	/**
	 * pahcer.tomlから設定を読み込む
	 * ファイルが見つからない場合や解析に失敗した場合は、デフォルト値を返す
	 *
	 * @returns 設定オブジェクト（デフォルト: 最大化問題）
	 */
	async loadSettings(): Promise<PahcerSettings> {
		const settingsPath = path.join(this.workspaceRoot, 'pahcer.toml');

		// ファイルが存在しない場合はデフォルト値を返す
		if (!fs.existsSync(settingsPath)) {
			return { objective: 'max' };
		}

		try {
			const content = fs.readFileSync(settingsPath, 'utf-8');
			const objective = this.parseObjective(content);

			return { objective };
		} catch (e) {
			console.error(`Failed to load pahcer.toml: ${e}`);
			// デフォルトは最大化問題
			return { objective: 'max' };
		}
	}

	/**
	 * TOMLコンテンツから objective フィールドを抽出
	 * TOML形式: [problem]セクション内の objective = "max" | "min"
	 *
	 * @param content TOMLファイルの内容
	 * @returns 'max' または 'min'（デフォルト: 'max'）
	 */
	private parseObjective(content: string): 'max' | 'min' {
		// 簡易的なTOML解析: objective = "max" または objective = "min" を探す
		const match = content.match(/objective\s*=\s*['"](max|min)['"]/i);

		if (match && (match[1].toLowerCase() === 'max' || match[1].toLowerCase() === 'min')) {
			return match[1].toLowerCase() as 'max' | 'min';
		}

		// デフォルトは最大化問題
		return 'max';
	}
}
