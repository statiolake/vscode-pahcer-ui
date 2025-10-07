import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ComparisonConfig } from '../domain/models/comparisonConfig';

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
				return JSON.parse(content);
			} catch (e) {
				console.error('Failed to load config:', e);
			}
		}
		return {};
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

	/**
	 * Featuresを更新
	 */
	async saveFeatures(features: string): Promise<void> {
		const config = await this.load();
		config.features = features;
		await this.save(config);
	}

	/**
	 * X軸を更新
	 */
	async saveXAxis(xAxis: string): Promise<void> {
		const config = await this.load();
		config.xAxis = xAxis;
		await this.save(config);
	}

	/**
	 * Y軸を更新
	 */
	async saveYAxis(yAxis: string): Promise<void> {
		const config = await this.load();
		config.yAxis = yAxis;
		await this.save(config);
	}
}
