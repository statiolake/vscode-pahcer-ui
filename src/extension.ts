import * as vscode from 'vscode';
import { addCommentCommand } from './controller/commands/addCommentCommand';
import { changeSortOrderCommand } from './controller/commands/changeSortOrderCommand';
import {
	openErrorFile,
	openInputFile,
	openOutputFile,
} from './controller/commands/openFileCommand';
import { runCommand } from './controller/commands/runCommand';
import { showDiffCommand } from './controller/commands/showDiffCommand';
import {
	switchToExecutionCommand,
	switchToSeedCommand,
} from './controller/commands/switchModeCommand';
import { ComparisonViewController } from './controller/comparisonViewController';
import { InitializationWebViewProvider } from './controller/initializationWebViewProvider';
import { PahcerTreeViewController } from './controller/pahcerTreeViewController';
import { RunOptionsWebViewProvider } from './controller/runOptionsWebViewProvider';
import { VisualizerViewController } from './controller/visualizerViewController';
import { FileWatcher } from './infrastructure/fileWatcher';
import { OutputFileRepository } from './infrastructure/outputFileRepository';
import { PahcerAdapter, PahcerStatus } from './infrastructure/pahcerAdapter';
import { PahcerResultRepository } from './infrastructure/pahcerResultRepository';
import { TerminalAdapter } from './infrastructure/terminalAdapter';
import { WorkspaceAdapter } from './infrastructure/workspaceAdapter';

export function activate(context: vscode.ExtensionContext) {
	const workspaceAdapter = new WorkspaceAdapter();
	const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

	if (!workspaceRoot) {
		return;
	}

	// Check pahcer installation and initialization status
	const pahcerAdapter = new PahcerAdapter(workspaceRoot);
	const pahcerStatus = pahcerAdapter.checkStatus();

	// Set context for viewsWelcome
	if (pahcerStatus === PahcerStatus.NotInstalled) {
		vscode.commands.executeCommand('setContext', 'pahcer.status', 'notInstalled');
	} else if (pahcerStatus === PahcerStatus.NotInitialized) {
		vscode.commands.executeCommand('setContext', 'pahcer.status', 'notInitialized');
	} else {
		vscode.commands.executeCommand('setContext', 'pahcer.status', 'ready');
	}

	// Register setup commands (always available)
	context.subscriptions.push(
		vscode.commands.registerCommand('pahcer-ui.openGitHub', () => {
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/terry-u16/pahcer'));
		}),
	);

	// Initialize context (hide initialization view by default)
	vscode.commands.executeCommand('setContext', 'pahcer.showInitialization', false);

	// Always create TreeViewController (it handles pahcer status internally)
	const treeViewController = new PahcerTreeViewController(workspaceRoot);

	// Register initialization WebView and command (always register, regardless of pahcer status)
	const initializationProvider = new InitializationWebViewProvider(context, workspaceRoot);
	const initializationWebView = vscode.window.registerWebviewViewProvider(
		'pahcerInitialization',
		initializationProvider,
	);

	const initializeCommand = vscode.commands.registerCommand('pahcer-ui.initialize', () => {
		// Show initialization WebView by switching context
		vscode.commands.executeCommand('setContext', 'pahcer.showInitialization', true);
	});

	context.subscriptions.push(initializationWebView, initializeCommand);

	// Create infrastructure components (always needed)
	const terminalAdapter = new TerminalAdapter();

	// Create TreeView (always create, but behavior differs based on pahcer status)
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: treeViewController,
		showCollapseAll: pahcerStatus === PahcerStatus.Ready,
		canSelectMany: false,
	});

	// Create all controllers (always create, but will error if used when not ready)
	const visualizerViewController = new VisualizerViewController(context, workspaceRoot);
	const comparisonViewController = new ComparisonViewController(context, workspaceRoot);
	const runOptionsWebViewProvider = new RunOptionsWebViewProvider(context, workspaceRoot);
	const resultRepository = new PahcerResultRepository(workspaceRoot);
	const outputFileRepository = new OutputFileRepository(workspaceRoot);

	// Initialize grouping context
	const updateGroupingContext = () => {
		const mode = treeViewController.getGroupingMode();
		vscode.commands.executeCommand('setContext', 'pahcer.groupingMode', mode);
	};
	updateGroupingContext();

	// Register ALL commands (always available, but may error if pahcer not ready)
	const allCommands = [
		vscode.commands.registerCommand('pahcer-ui.refresh', () => {
			treeViewController.refresh();
		}),
		vscode.commands.registerCommand('pahcer-ui.run', () =>
			runCommand(workspaceAdapter, terminalAdapter),
		),
		vscode.commands.registerCommand('pahcer-ui.runWithOptions', () => {
			vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', true);
		}),
		vscode.commands.registerCommand('pahcer-ui.changeSortOrder', () =>
			changeSortOrderCommand(treeViewController),
		),
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

	// Register RunOptions WebView Provider
	const runOptionsWebView = vscode.window.registerWebviewViewProvider(
		'pahcerRunOptions',
		runOptionsWebViewProvider,
	);

	// Initialize context (show TreeView by default)
	vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', false);

	// Watch for changes in pahcer/json directory (always watch, regardless of pahcer status)
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

	// Handle checkbox state changes (always register)
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

	context.subscriptions.push(treeView, runOptionsWebView, watcher, ...allCommands);
}

export function deactivate() {}
