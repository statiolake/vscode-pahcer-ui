import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ComparisonView } from './comparisonView';
import { PahcerResultsProvider } from './pahcerResultsProvider';
import { VisualizerManager } from './visualizerManager';

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	// Create TreeView provider
	const pahcerResultsProvider = new PahcerResultsProvider(workspaceRoot);
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: pahcerResultsProvider,
		showCollapseAll: true,
		canSelectMany: false,
	});

	// Handle checkbox state changes
	treeView.onDidChangeCheckboxState((e) => {
		for (const [item] of e.items) {
			if (item.resultId) {
				pahcerResultsProvider.toggleCheckbox(item.resultId);
			}
		}
		// Update context to show/hide compare button
		const checkedCount = pahcerResultsProvider.getCheckedResults().length;
		vscode.commands.executeCommand('setContext', 'pahcer.hasMultipleChecked', checkedCount >= 2);
	});

	// Create VisualizerManager
	const visualizerManager = workspaceRoot ? new VisualizerManager(context, workspaceRoot) : null;

	// Create ComparisonView
	const comparisonView = workspaceRoot ? new ComparisonView(context, workspaceRoot) : null;

	// Watch for changes in pahcer/json directory
	if (workspaceRoot) {
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(workspaceRoot, 'pahcer/json/result_*.json'),
		);

		watcher.onDidCreate((uri) => {
			// Copy tools/out and tools/err to .pahcer-ui/result_${id}/
			copyOutputFiles(workspaceRoot, uri.fsPath);
			pahcerResultsProvider.refresh();
		});
		watcher.onDidChange(() => pahcerResultsProvider.refresh());
		watcher.onDidDelete(() => pahcerResultsProvider.refresh());

		context.subscriptions.push(watcher);
	}

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('vscode-pahcer-ui.refresh', () => {
		pahcerResultsProvider.refresh();
	});

	// Update context for button visibility
	const updateGroupingContext = () => {
		const mode = pahcerResultsProvider.getGroupingMode();
		vscode.commands.executeCommand('setContext', 'pahcer.groupingMode', mode);
	};

	const switchToSeedCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.switchToSeed',
		() => {
			pahcerResultsProvider.setGroupingMode('bySeed');
			updateGroupingContext();
		},
	);

	const switchToExecutionCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.switchToExecution',
		() => {
			pahcerResultsProvider.setGroupingMode('byExecution');
			updateGroupingContext();
		},
	);

	// Initialize context
	updateGroupingContext();

	// Compare command
	const compareCommand = vscode.commands.registerCommand('vscode-pahcer-ui.compare', async () => {
		if (!comparisonView) {
			vscode.window.showErrorMessage('ワークスペースが開かれていません');
			return;
		}

		const checkedResults = pahcerResultsProvider.getCheckedResults();
		if (checkedResults.length < 2) {
			vscode.window.showErrorMessage('比較するには2つ以上の実行結果を選択してください');
			return;
		}

		await comparisonView.showComparison(checkedResults);
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
		async (seed: number, resultId?: string) => {
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
			const outputPath = resultId
				? path.join(
						workspaceRoot,
						'.pahcer-ui',
						'results',
						`result_${resultId}`,
						'out',
						`${String(seed).padStart(4, '0')}.txt`,
					)
				: path.join(workspaceRoot, 'tools', 'out', `${String(seed).padStart(4, '0')}.txt`);

			// Check if output file exists
			if (!fs.existsSync(outputPath)) {
				vscode.window.showErrorMessage(
					'出力が見つかりません。Pahcer UI 以外で実行された可能性があります。',
				);
				return;
			}

			try {
				await visualizerManager.showVisualizerForCase(seed, inputPath, outputPath, resultId);
			} catch (error) {
				vscode.window.showErrorMessage(`ビジュアライザの表示に失敗しました: ${error}`);
			}
		},
	);

	context.subscriptions.push(
		treeView,
		refreshCommand,
		runCommand,
		showVisualizerCommand,
		switchToSeedCommand,
		switchToExecutionCommand,
		compareCommand,
	);
}

function copyOutputFiles(workspaceRoot: string, resultJsonPath: string) {
	try {
		// Extract result ID from filename (e.g., result_20241005_123456.json -> 20241005_123456)
		const fileName = path.basename(resultJsonPath);
		const match = fileName.match(/^result_(.+)\.json$/);
		if (!match) {
			return;
		}

		const resultId = match[1];
		const destDir = path.join(workspaceRoot, '.pahcer-ui', 'results', `result_${resultId}`);

		// Create destination directory
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Copy tools/out directory
		const toolsOutDir = path.join(workspaceRoot, 'tools', 'out');
		if (fs.existsSync(toolsOutDir)) {
			const outDestDir = path.join(destDir, 'out');
			fs.cpSync(toolsOutDir, outDestDir, { recursive: true });
		}

		// Copy tools/err directory
		const toolsErrDir = path.join(workspaceRoot, 'tools', 'err');
		if (fs.existsSync(toolsErrDir)) {
			const errDestDir = path.join(destDir, 'err');
			fs.cpSync(toolsErrDir, errDestDir, { recursive: true });
		}

		console.log(`Copied output files to ${destDir}`);
	} catch (error) {
		console.error('Failed to copy output files:', error);
	}
}

export function deactivate() {}
