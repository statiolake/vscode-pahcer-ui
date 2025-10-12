import * as vscode from 'vscode';
import type {
	ExecutionSortOrder,
	GroupingMode,
	SeedSortOrder,
} from '../domain/services/sortingService';

/**
 * VSCode設定の読み書きを抽象化
 */
export class ConfigAdapter {
	private readonly CONFIG_SECTION = 'pahcer-ui';

	/**
	 * グルーピングモードを取得
	 */
	getGroupingMode(): GroupingMode {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<GroupingMode>('groupingMode') || 'byExecution';
	}

	/**
	 * グルーピングモードを設定
	 */
	async setGroupingMode(mode: GroupingMode): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('groupingMode', mode, vscode.ConfigurationTarget.Global);
	}

	/**
	 * 実行ごとのソート順を取得
	 */
	getExecutionSortOrder(): ExecutionSortOrder {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<ExecutionSortOrder>('executionSortOrder') || 'seedAsc';
	}

	/**
	 * 実行ごとのソート順を設定
	 */
	async setExecutionSortOrder(order: ExecutionSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('executionSortOrder', order, vscode.ConfigurationTarget.Global);
	}

	/**
	 * Seedごとのソート順を取得
	 */
	getSeedSortOrder(): SeedSortOrder {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<SeedSortOrder>('seedSortOrder') || 'executionDesc';
	}

	/**
	 * Seedごとのソート順を設定
	 */
	async setSeedSortOrder(order: SeedSortOrder): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('seedSortOrder', order, vscode.ConfigurationTarget.Global);
	}

	/**
	 * ビジュアライザのズームレベルを取得
	 */
	getVisualizerZoomLevel(): number {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<number>('visualizerZoomLevel') || 1.0;
	}

	/**
	 * ビジュアライザのズームレベルを設定
	 */
	async setVisualizerZoomLevel(zoomLevel: number): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('visualizerZoomLevel', zoomLevel, vscode.ConfigurationTarget.Global);
	}

	/**
	 * Git統合の有効/無効を取得
	 */
	getGitIntegration(): boolean | null {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<boolean | null>('gitIntegration') ?? null;
	}

	/**
	 * Git統合の有効/無効を設定
	 */
	async setGitIntegration(enabled: boolean): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		await config.update('gitIntegration', enabled, vscode.ConfigurationTarget.Workspace);
	}
}
