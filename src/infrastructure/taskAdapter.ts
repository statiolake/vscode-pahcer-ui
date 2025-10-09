import * as vscode from 'vscode';

/**
 * VSCodeタスク操作を抽象化
 * 読み取り専用の出力ビューでコマンドを実行
 */
export class TaskAdapter {
	/**
	 * タスクを作成して実行
	 */
	async runTask(name: string, command: string, cwd: string): Promise<void> {
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

		await vscode.tasks.executeTask(task);
	}

	/**
	 * pahcer runを実行
	 */
	async runPahcer(workspaceRoot: string): Promise<void> {
		await this.runTask('Pahcer Run', 'pahcer run', workspaceRoot);
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
