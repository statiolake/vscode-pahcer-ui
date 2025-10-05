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
	treeView.onDidChangeCheckboxState(async (e) => {
		for (const [item] of e.items) {
			if (item.resultId) {
				pahcerResultsProvider.toggleCheckbox(item.resultId);
			}
		}

		// Auto-show comparison view when checkboxes change
		const checkedResults = pahcerResultsProvider.getCheckedResults();
		if (comparisonView) {
			await comparisonView.showComparison(checkedResults);
		}
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

	// Toggle comparison mode command
	const toggleComparisonModeCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.toggleComparisonMode',
		() => {
			const currentMode = pahcerResultsProvider.getComparisonMode();
			pahcerResultsProvider.setComparisonMode(!currentMode);
		},
	);

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

	// Register add comment command
	const addCommentCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.addComment',
		async (item: any) => {
			if (!workspaceRoot || !item?.resultId) {
				return;
			}

			const comment = await vscode.window.showInputBox({
				prompt: 'コメントを入力してください',
				placeHolder: 'この実行についてのメモ...',
				value: item.comment || '',
			});

			if (comment === undefined) {
				return;
			}

			// Save comment to meta.json
			const resultDir = path.join(
				workspaceRoot,
				'.pahcer-ui',
				'results',
				`result_${item.resultId}`,
			);
			if (!fs.existsSync(resultDir)) {
				fs.mkdirSync(resultDir, { recursive: true });
			}

			const metaPath = path.join(resultDir, 'meta.json');
			const meta = { comment };
			fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

			// Refresh tree view
			pahcerResultsProvider.refresh();
			vscode.window.showInformationMessage('コメントを保存しました');
		},
	);

	// Register change sort order command
	const changeSortOrderCommand = vscode.commands.registerCommand(
		'vscode-pahcer-ui.changeSortOrder',
		async () => {
			const mode = pahcerResultsProvider.getGroupingMode();

			if (mode === 'byExecution') {
				const currentOrder = pahcerResultsProvider.getExecutionSortOrder();
				const options = [
					{ label: 'シードの昇順', value: 'seedAsc' as const },
					{ label: '相対スコアの降順', value: 'relativeScoreDesc' as const },
					{ label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
				];

				const selected = await vscode.window.showQuickPick(options, {
					placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
				});

				if (selected) {
					pahcerResultsProvider.setExecutionSortOrder(selected.value);
				}
			} else {
				const currentOrder = pahcerResultsProvider.getSeedSortOrder();
				const options = [
					{ label: '実行の降順', value: 'executionDesc' as const },
					{ label: '絶対スコアの降順', value: 'absoluteScoreDesc' as const },
				];

				const selected = await vscode.window.showQuickPick(options, {
					placeHolder: `現在: ${options.find((o) => o.value === currentOrder)?.label}`,
				});

				if (selected) {
					pahcerResultsProvider.setSeedSortOrder(selected.value);
				}
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
		toggleComparisonModeCommand,
		addCommentCommand,
		changeSortOrderCommand,
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
