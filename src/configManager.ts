import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PahcerUiConfig {
	features?: string; // e.g., "N M K"
	xAxis?: string; // e.g., "seed", "N", "log(N)"
	yAxis?: string; // e.g., "absolute", "relative"
}

export class ConfigManager {
	private configPath: string;
	private config: PahcerUiConfig;

	constructor(workspaceRoot: string) {
		const configDir = path.join(workspaceRoot, '.pahcer-ui');
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}
		this.configPath = path.join(configDir, 'config.json');
		this.config = this.loadConfig();
	}

	private loadConfig(): PahcerUiConfig {
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

	private saveConfig(): void {
		try {
			fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch (e) {
			console.error('Failed to save config:', e);
		}
	}

	getFeatures(): string {
		return this.config.features || '';
	}

	setFeatures(features: string): void {
		this.config.features = features;
		this.saveConfig();
	}

	getXAxis(): string {
		return this.config.xAxis || 'seed';
	}

	setXAxis(xAxis: string): void {
		this.config.xAxis = xAxis;
		this.saveConfig();
	}

	getYAxis(): string {
		return this.config.yAxis || 'absolute';
	}

	setYAxis(yAxis: string): void {
		this.config.yAxis = yAxis;
		this.saveConfig();
	}

	getConfig(): PahcerUiConfig {
		return { ...this.config };
	}
}
