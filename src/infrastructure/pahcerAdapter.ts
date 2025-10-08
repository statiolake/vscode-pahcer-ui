import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * pahcerのインストール状態
 */
export enum PahcerStatus {
	/** pahcerがインストールされていない */
	NotInstalled,
	/** pahcerはインストールされているが初期化されていない */
	NotInitialized,
	/** pahcerがインストールされ初期化済み */
	Ready,
}

/**
 * pahcer CLIツールの状態をチェックするアダプター
 */
export class PahcerAdapter {
	constructor(private workspaceRoot: string) {}

	/**
	 * pahcerのインストール・初期化状態を確認
	 */
	checkStatus(): PahcerStatus {
		// Check if pahcer is installed
		if (!this.isPahcerInstalled()) {
			return PahcerStatus.NotInstalled;
		}

		// Check if pahcer is initialized (pahcer_config.toml exists)
		if (!this.isInitialized()) {
			return PahcerStatus.NotInitialized;
		}

		return PahcerStatus.Ready;
	}

	/**
	 * pahcerコマンドがインストールされているかチェック
	 */
	private isPahcerInstalled(): boolean {
		try {
			execSync('pahcer --version', { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * pahcerが初期化されているかチェック（pahcer_config.tomlの存在確認）
	 */
	private isInitialized(): boolean {
		const configPath = path.join(this.workspaceRoot, 'pahcer_config.toml');
		return fs.existsSync(configPath);
	}
}
