import * as path from 'node:path';
import * as vscode from 'vscode';
import { PahcerResultsProvider } from './pahcerResultsProvider';
import { VisualizerManager } from './visualizerManager';

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	// Create TreeView provider
	const pahcerResultsProvider = new PahcerResultsProvider(workspaceRoot);
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: pahcerResultsProvider,
		showCollapseAll: true,
	});

	// Create VisualizerManager
	const visualizerManager = workspaceRoot ? new VisualizerManager(context, workspaceRoot) : null;

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

	// Register visualizer command
	const showVisualizerCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.showVisualizer',
		async (seed: number) => {
			if (!visualizerManager || !workspaceRoot) {
				vscode.window.showErrorMessage('ワークスペースが開かれていません');
				return;
			}

			// Find input and output files for this seed
			const inputPath = path.join(
				workspaceRoot,
				'tools',
				'in',
				`${String(seed).padStart(4, '0')}.txt`,
			);
			const outputPath = path.join(
				workspaceRoot,
				'tools',
				'out',
				`${String(seed).padStart(4, '0')}.txt`,
			);

			try {
				await visualizerManager.showVisualizerForCase(seed, inputPath, outputPath);
			} catch (error) {
				vscode.window.showErrorMessage(`ビジュアライザの表示に失敗しました: ${error}`);
			}
		},
	);

	context.subscriptions.push(treeView, refreshCommand, runCommand, showVisualizerCommand);
}

export function deactivate() {}
