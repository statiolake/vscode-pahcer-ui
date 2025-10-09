import * as vscode from 'vscode';

/**
 * VSCodeタスク操作を抽象化
 * 読み取り専用の出力ビューでコマンドを実行
 */
export class TaskAdapter {
	/**
	 * タスクを作成して実行し、完了を待つ
	 * @returns タスクの終了コード（成功なら0）
	 */
	async runTask(name: string, command: string, cwd: string): Promise<number | undefined> {
		const taskExecution = new vscode.ShellExecution(command, {
			cwd,
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
	 * pahcer runを実行
	 * @returns タスクの終了コード（成功なら0）
	 */
	async runPahcer(workspaceRoot: string): Promise<number | undefined> {
		return this.runTask('Pahcer Run', 'pahcer run', workspaceRoot);
	}

	/**
	 * pahcer initを実行
	 */
	async runPahcerInit(
		workspaceRoot: string,
		problemName: string,
		objective: 'max' | 'min',
		language: 'rust' | 'cpp' | 'python' | 'go',
		isInteractive: boolean,
	): Promise<void> {
		let command = `pahcer init --problem "${problemName}" --objective ${objective} --lang ${language}`;
		if (isInteractive) {
			command += ' --interactive';
		}
		await this.runTask('Pahcer Init', command, workspaceRoot);
	}
}
