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
import {
	type PahcerTreeItem,
	PahcerTreeViewController,
} from './controller/pahcerTreeViewController';
import { RunOptionsWebViewProvider } from './controller/runOptionsWebViewProvider';
import { VisualizerViewController } from './controller/visualizerViewController';
import { ExecutionRepository } from './infrastructure/executionRepository';
import { OutputFileRepository } from './infrastructure/outputFileRepository';
import { PahcerAdapter, PahcerStatus } from './infrastructure/pahcerAdapter';
import { TaskAdapter } from './infrastructure/taskAdapter';
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

	// Create infrastructure components (always needed)
	const taskAdapter = new TaskAdapter();

	// Register initialization WebView and command (always register, regardless of pahcer status)
	const initializationProvider = new InitializationWebViewProvider(
		context,
		workspaceRoot,
		taskAdapter,
	);
	const initializationWebView = vscode.window.registerWebviewViewProvider(
		'pahcerInitialization',
		initializationProvider,
	);

	const initializeCommand = vscode.commands.registerCommand('pahcer-ui.initialize', () => {
		// Show initialization WebView by switching context
		vscode.commands.executeCommand('setContext', 'pahcer.showInitialization', true);
	});

	context.subscriptions.push(initializationWebView, initializeCommand);

	// Create TreeView (always create, but behavior differs based on pahcer status)
	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: treeViewController,
		showCollapseAll: pahcerStatus === PahcerStatus.Ready,
		canSelectMany: false,
	});

	// Create all controllers (always create, but will error if used when not ready)
	const visualizerViewController = new VisualizerViewController(context, workspaceRoot);
	const comparisonViewController = new ComparisonViewController(context, workspaceRoot);
	const executionRepository = new ExecutionRepository(workspaceRoot);
	const outputFileRepository = new OutputFileRepository(workspaceRoot);
	const runOptionsWebViewProvider = new RunOptionsWebViewProvider(
		context,
		workspaceRoot,
		taskAdapter,
		outputFileRepository,
		executionRepository,
	);

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
		vscode.commands.registerCommand('pahcer-ui.run', async () => {
			await runCommand(
				workspaceAdapter,
				taskAdapter,
				outputFileRepository,
				executionRepository,
				treeViewController,
			);
		}),
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
			async (seed: number, executionId?: string) => {
				await visualizerViewController.showVisualizerForCase(seed, executionId);
			},
		),
		vscode.commands.registerCommand('pahcer-ui.showResultsNotFoundError', (seed: number) => {
			const seedStr = String(seed).padStart(4, '0');
			vscode.window.showErrorMessage(
				`Seed ${seedStr} の結果が見つからないため、ビジュアライザを開けません。`,
			);
		}),
		vscode.commands.registerCommand('pahcer-ui.addComment', (item: PahcerTreeItem) => {
			addCommentCommand(item, executionRepository, treeViewController);
		}),
		vscode.commands.registerCommand('pahcer-ui.openInputFile', (item: PahcerTreeItem) => {
			if (!item.seed) {
				return;
			}
			return openInputFile(workspaceRoot, item.seed);
		}),
		vscode.commands.registerCommand('pahcer-ui.openOutputFile', (item: PahcerTreeItem) => {
			if (
				item &&
				typeof item === 'object' &&
				'seed' in item &&
				typeof item.seed === 'number' &&
				'executionId' in item &&
				typeof item.executionId === 'string'
			) {
				return openOutputFile(workspaceRoot, item.executionId, item.seed);
			}
		}),
		vscode.commands.registerCommand('pahcer-ui.openErrorFile', (item: PahcerTreeItem) => {
			if (
				item &&
				typeof item === 'object' &&
				'seed' in item &&
				typeof item.seed === 'number' &&
				'executionId' in item &&
				typeof item.executionId === 'string'
			) {
				return openErrorFile(workspaceRoot, item.executionId, item.seed);
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

	// Handle checkbox state changes (always register)
	treeView.onDidChangeCheckboxState(async (e) => {
		for (const [item] of e.items) {
			if (item.executionId) {
				treeViewController.toggleCheckbox(item.executionId);
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

	context.subscriptions.push(treeView, runOptionsWebView, ...allCommands);
}

export function deactivate() {}
