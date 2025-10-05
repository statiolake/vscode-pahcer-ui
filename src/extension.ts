import * as vscode from 'vscode';
import { PahcerResultsProvider } from './pahcerResultsProvider';

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	// Create TreeView provider
	const pahcerResultsProvider = new PahcerResultsProvider(workspaceRoot);
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: pahcerResultsProvider,
		showCollapseAll: true,
	});

	// Watch for changes in pahcer/json directory
	if (workspaceRoot) {
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(workspaceRoot, 'pahcer/json/result_*.json'),
		);

		watcher.onDidCreate(() => pahcerResultsProvider.refresh());
		watcher.onDidChange(() => pahcerResultsProvider.refresh());
		watcher.onDidDelete(() => pahcerResultsProvider.refresh());

		context.subscriptions.push(watcher);
	}

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('vscode-pahcer-ui.refresh', () => {
		pahcerResultsProvider.refresh();
	});

	// Register run command
	const runCommand = vscode.commands.registerCommand('vscode-pahcer-ui.run', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('ワークスペースが開かれていません');
			return;
		}

		const terminal = vscode.window.createTerminal({
			name: 'Pahcer Run',
			cwd: workspaceFolder.uri.fsPath,
		});

		terminal.show();
		terminal.sendText('pahcer run');
	});

	context.subscriptions.push(treeView, refreshCommand, runCommand);
}

export function deactivate() {}
