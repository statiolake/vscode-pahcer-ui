import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { ExecutionRepository } from './executionRepository';
import type { GitAdapter } from './gitAdapter';
import type { InOutRepository } from './inOutRepository';
import type { PahcerConfigFileRepository } from './pahcerConfigFileRepository';
import { TestCaseRepository } from './testCaseRepository';

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
 * pahcer run のオプション
 */
export interface PahcerRunOptions {
	startSeed?: number;
	endSeed?: number;
	freezeBestScores?: boolean;
}

/**
 * pahcer run の実行結果
 */
export interface PahcerRunResult {
	exitCode: number | undefined;
	commitHash: string | null;
	resultId: string | null;
	caseCount: number;
	totalScore: number;
}

/**
 * pahcer CLIツールの実行と状態をチェックするアダプター
 */
export class PahcerAdapter {
	constructor(
		private pahcerConfigFileRepository: PahcerConfigFileRepository,
		private gitAdapter?: GitAdapter,
		private inOutRepository?: InOutRepository,
		private executionRepository?: ExecutionRepository,
		private workspaceRoot?: string,
	) {}

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
	 * pahcer run を実行（Git統合、出力ファイルコピー含む）
	 */
	async run(options?: PahcerRunOptions): Promise<PahcerRunResult> {
		if (!this.workspaceRoot) {
			throw new Error('workspaceRoot is required for run()');
		}

		const result: PahcerRunResult = {
			exitCode: undefined,
			commitHash: null,
			resultId: null,
			caseCount: 0,
			totalScore: 0,
		};

		// Step 1: Git統合 - 実行前にソースコードをコミット
		if (this.gitAdapter) {
			try {
				result.commitHash = await this.gitAdapter.commitSourceBeforeExecution();
			} catch (error) {
				throw new Error(`gitの操作に失敗しました: ${error}`);
			}
		}

		// Step 2: テンポラリ設定ファイルを作成（必要な場合）
		let tempConfigPath: string | null = null;
		if (options?.startSeed !== undefined || options?.endSeed !== undefined) {
			tempConfigPath = await this.createTempConfig(options);
		}

		// Step 3: コマンドラインを組み立てる
		let command = 'pahcer run';
		if (tempConfigPath) {
			command += ` --setting-file "${tempConfigPath}"`;
		}
		if (options?.freezeBestScores) {
			command += ' --freeze-best-scores';
		}

		// Step 4: タスクを作成して実行
		result.exitCode = await this.executeTask('Pahcer Run', command);

		// Step 5: テンポラリ設定ファイルをクリーンアップ
		if (tempConfigPath && fs.existsSync(tempConfigPath)) {
			fs.unlinkSync(tempConfigPath);
		}

		// Step 6: 出力ファイルをコピーしてメタデータを保存
		if (this.inOutRepository && this.executionRepository) {
			const latestExecution = await this.executionRepository.getLatestExecution();
			if (latestExecution) {
				result.resultId = latestExecution.id;
				await this.inOutRepository.copyOutputFiles(
					latestExecution.id,
					latestExecution,
					result.commitHash || undefined,
				);

				// Step 7: Git統合 - 実行後に結果をコミット
				if (this.gitAdapter) {
					try {
						const testCaseRepository = new TestCaseRepository(this.workspaceRoot);
						const allTestCases = await testCaseRepository.loadAllTestCases();
						const executionTestCases = allTestCases.filter(
							(tc) => tc.executionId === latestExecution.id,
						);
						result.caseCount = executionTestCases.length;
						result.totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);
						await this.gitAdapter.commitResultsAfterExecution(result.caseCount, result.totalScore);
					} catch (error) {
						throw new Error(`結果コミットに失敗しました: ${error}`);
					}
				}
			}
		}

		return result;
	}

	/**
	 * pahcer init を実行
	 */
	async init(
		problemName: string,
		objective: 'max' | 'min',
		language: 'rust' | 'cpp' | 'python' | 'go',
		isInteractive: boolean,
	): Promise<number | undefined> {
		if (!this.workspaceRoot) {
			throw new Error('workspaceRoot is required for init()');
		}

		let command = `pahcer init --problem "${problemName}" --objective ${objective} --lang ${language}`;
		if (isInteractive) {
			command += ' --interactive';
		}
		return this.executeTask('Pahcer Init', command);
	}

	/**
	 * タスクを作成して実行し、完了を待つ
	 */
	private async executeTask(name: string, command: string): Promise<number | undefined> {
		if (!this.workspaceRoot) {
			throw new Error('workspaceRoot is required for executeTask()');
		}

		const taskExecution = new vscode.ShellExecution(command, {
			cwd: this.workspaceRoot,
		});

		const task = new vscode.Task(
			{ type: 'pahcer', task: name },
			vscode.TaskScope.Workspace,
			name,
			'pahcer',
			taskExecution,
		);

		// Show task output in terminal panel
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			focus: false,
			panel: vscode.TaskPanelKind.Shared,
			showReuseMessage: false,
			clear: false,
		};

		const execution = await vscode.tasks.executeTask(task);

		// Wait for task completion
		return new Promise<number | undefined>((resolve) => {
			const disposable = vscode.tasks.onDidEndTask((e) => {
				if (e.execution === execution) {
					disposable.dispose();
					resolve(e.execution.task.execution ? 0 : undefined);
				}
			});
		});
	}

	/**
	 * テンポラリ設定ファイルを作成
	 */
	private async createTempConfig(options: PahcerRunOptions): Promise<string> {
		if (!this.workspaceRoot) {
			throw new Error('workspaceRoot is required for createTempConfig()');
		}

		// Read original config from infrastructure layer
		let configContent = this.pahcerConfigFileRepository.read();

		// Replace start_seed and end_seed if specified
		if (options.startSeed !== undefined) {
			configContent = configContent.replace(
				/start_seed\s*=\s*\d+/,
				`start_seed = ${options.startSeed}`,
			);
		}
		if (options.endSeed !== undefined) {
			configContent = configContent.replace(/end_seed\s*=\s*\d+/, `end_seed = ${options.endSeed}`);
		}

		// Create temp file with modified config
		const tempFilePath = `${this.workspaceRoot}/.pahcer-temp-config.toml`;
		fs.writeFileSync(tempFilePath, configContent);

		return tempFilePath;
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
		return this.pahcerConfigFileRepository.exists();
	}
}
