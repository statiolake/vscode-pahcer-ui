import * as vscode from 'vscode';
import { addCommentCommand } from './controller/commands/addCommentCommand';
import { changeSortOrderCommand } from './controller/commands/changeSortOrderCommand';
import {
	openErrorFile,
	openInputFile,
	openOutputFile,
} from './controller/commands/openFileCommand';
import { refreshCommand } from './controller/commands/refreshCommand';
import { runCommand } from './controller/commands/runCommand';
import { showDiffCommand } from './controller/commands/showDiffCommand';
import {
	switchToExecutionCommand,
	switchToSeedCommand,
} from './controller/commands/switchModeCommand';
import { ComparisonViewController } from './controller/comparisonViewController';
import { PahcerTreeViewController } from './controller/pahcerTreeViewController';
import { RunOptionsWebViewProvider } from './controller/runOptionsWebViewProvider';
import { VisualizerViewController } from './controller/visualizerViewController';
import { FileWatcher } from './infrastructure/fileWatcher';
import { OutputFileRepository } from './infrastructure/outputFileRepository';
import { PahcerResultRepository } from './infrastructure/pahcerResultRepository';
import { TerminalAdapter } from './infrastructure/terminalAdapter';
import { WorkspaceAdapter } from './infrastructure/workspaceAdapter';

export function activate(context: vscode.ExtensionContext) {
	const workspaceAdapter = new WorkspaceAdapter();
	const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

	if (!workspaceRoot) {
		return;
	}

	// Create controllers
	const treeViewController = new PahcerTreeViewController(workspaceRoot);
	const visualizerViewController = new VisualizerViewController(context, workspaceRoot);
	const comparisonViewController = new ComparisonViewController(context, workspaceRoot);
	const runOptionsWebViewProvider = new RunOptionsWebViewProvider(context, workspaceRoot);

	// Create infrastructure components
	const terminalAdapter = new TerminalAdapter();
	const resultRepository = new PahcerResultRepository(workspaceRoot);
	const outputFileRepository = new OutputFileRepository(workspaceRoot);

	// Create TreeView
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: treeViewController,
		showCollapseAll: true,
		canSelectMany: false,
	});

	// Register RunOptions WebView Provider
	const runOptionsWebView = vscode.window.registerWebviewViewProvider(
		'pahcerRunOptions',
		runOptionsWebViewProvider,
	);

	// Initialize context (show TreeView by default)
	vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', false);

	// Handle checkbox state changes
	treeView.onDidChangeCheckboxState(async (e) => {
		for (const [item] of e.items) {
			if ((item as any).resultId) {
				treeViewController.toggleCheckbox((item as any).resultId);
			}
		}

		// Auto-show comparison view when checkboxes change
		const checkedResults = treeViewController.getCheckedResults();
		await comparisonViewController.showComparison(checkedResults);

		// Update context for diff button visibility
		const resultsWithCommitHash = await treeViewController.getCheckedResultsWithCommitHash();
		vscode.commands.executeCommand(
			'setContext',
			'pahcer.canShowDiff',
			resultsWithCommitHash.length === 2,
		);
	});

	// Watch for changes in pahcer/json directory
	const watcher = new FileWatcher(workspaceRoot, 'pahcer/json/result_*.json', {
		onCreate: async (uri) => {
			// Extract result ID from path
			const fileName = uri.fsPath.split('/').pop();
			const match = fileName?.match(/^result_(.+)\.json$/);
			if (match) {
				const resultId = match[1];
				await outputFileRepository.copyOutputFiles(resultId);
			}
			treeViewController.refresh();
		},
		onChange: () => treeViewController.refresh(),
		onDelete: () => treeViewController.refresh(),
	});

	// Update context for button visibility
	const updateGroupingContext = () => {
		const mode = treeViewController.getGroupingMode();
		vscode.commands.executeCommand('setContext', 'pahcer.groupingMode', mode);
	};

	// Initialize context
	updateGroupingContext();

	// Register commands
	const commands = [
		vscode.commands.registerCommand('pahcer-ui.run', () =>
			runCommand(workspaceAdapter, terminalAdapter),
		),
		vscode.commands.registerCommand('pahcer-ui.runWithOptions', () => {
			// Show RunOptions WebView by switching context
			vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', true);
		}),
		vscode.commands.registerCommand('pahcer-ui.refresh', () => refreshCommand(treeViewController)),
		vscode.commands.registerCommand('pahcer-ui.switchToSeed', () =>
			switchToSeedCommand(treeViewController, updateGroupingContext),
		),
		vscode.commands.registerCommand('pahcer-ui.switchToExecution', () =>
			switchToExecutionCommand(treeViewController, updateGroupingContext),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.showVisualizer',
			async (seed: number, resultId?: string) => {
				const inputPath = `${workspaceRoot}/tools/in/${String(seed).padStart(4, '0')}.txt`;
				const outputPath = resultId
					? `${workspaceRoot}/.pahcer-ui/results/result_${resultId}/out/${String(seed).padStart(4, '0')}.txt`
					: `${workspaceRoot}/tools/out/${String(seed).padStart(4, '0')}.txt`;

				await visualizerViewController.showVisualizerForCase(seed, inputPath, outputPath, resultId);
			},
		),
		vscode.commands.registerCommand('pahcer-ui.showResultsNotFoundError', (seed: number) => {
			const seedStr = String(seed).padStart(4, '0');
			vscode.window.showErrorMessage(
				`Seed ${seedStr} の結果が見つからないため、ビジュアライザを開けません。`,
			);
		}),
		vscode.commands.registerCommand('pahcer-ui.addComment', (item: any) =>
			addCommentCommand(item, resultRepository, treeViewController),
		),
		vscode.commands.registerCommand('pahcer-ui.changeSortOrder', () =>
			changeSortOrderCommand(treeViewController),
		),
		vscode.commands.registerCommand('pahcer-ui.openInputFile', (item: any) => {
			if (item?.seed !== undefined) {
				return openInputFile(workspaceRoot, item.seed);
			}
		}),
		vscode.commands.registerCommand('pahcer-ui.openOutputFile', (item: any) => {
			if (item?.seed !== undefined) {
				return openOutputFile(workspaceRoot, item.resultId, item.seed);
			}
		}),
		vscode.commands.registerCommand('pahcer-ui.openErrorFile', (item: any) => {
			if (item?.seed !== undefined) {
				return openErrorFile(workspaceRoot, item.resultId, item.seed);
			}
		}),
		vscode.commands.registerCommand('pahcer-ui.showDiff', () =>
			showDiffCommand(treeViewController, workspaceRoot),
		),
	];

	context.subscriptions.push(treeView, runOptionsWebView, watcher, ...commands);
}

export function deactivate() {}
