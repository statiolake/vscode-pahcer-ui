import { execSync } from 'node:child_process';
import * as vscode from 'vscode';
import type { PahcerConfig } from '../domain/models/configFile';
import type { PahcerConfigRepository } from './pahcerConfigRepository';

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
 * pahcer CLIツールの実行と状態をチェックするアダプター
 *
 * 責務:
 * - pahcer CLIコマンドの実行
 * - pahcerのインストール・初期化状態の確認
 * - テンポラリ設定ファイルの作成・管理（pahcer実行時のみ）
 *
 * 注：ビジネスロジック（Git統合、ファイルコピー、解析）はRunPahcerUseCaseに委譲
 */
export class PahcerAdapter {
  constructor(
    private pahcerConfigRepository: PahcerConfigRepository,
    private workspaceRoot: string,
  ) {}

  /**
   * pahcerのインストール・初期化状態を確認
   */
  async checkStatus(): Promise<PahcerStatus> {
    // Check if pahcer is installed
    if (!this.isPahcerInstalled()) {
      return PahcerStatus.NotInstalled;
    }

    // Check if pahcer is initialized (pahcer_config.toml exists)
    if (!(await this.isInitialized())) {
      return PahcerStatus.NotInitialized;
    }

    return PahcerStatus.Ready;
  }

  /**
   * pahcer run コマンドを実行（コマンド実行のみ）
   * @param options 実行オプション
   * @param configFile テンポラリ設定ファイル（あれば使用）
   * @returns 終了コード
   */
  async run(options?: PahcerRunOptions, configFile?: PahcerConfig): Promise<number | undefined> {
    // Step 1: コマンドラインを組み立てる
    let command = 'pahcer run';
    if (configFile) {
      command += ` --setting-file "${configFile.path}"`;
    }
    if (options?.freezeBestScores) {
      command += ' --freeze-best-scores';
    }

    // Step 2: タスクを作成して実行
    return this.executeTask('Pahcer Run', command);
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
   * pahcerが初期化されているかチェック（pahcer_config.tomlが正常に読み込めるか確認）
   */
  private async isInitialized(): Promise<boolean> {
    try {
      await this.pahcerConfigRepository.get('normal');
      return true;
    } catch {
      return false;
    }
  }
}
