import * as vscode from 'vscode';
import { addCommentCommand } from './controller/commands/addCommentCommand';
import { changeSortOrderCommand } from './controller/commands/changeSortOrderCommand';
import { initializeCommand } from './controller/commands/initializeCommand';
import {
	openErrorFileCommand,
	openInputFileCommand,
	openOutputFileCommand,
} from './controller/commands/openFileCommand';
import { openGitHubCommand } from './controller/commands/openGitHubCommand';
import { refreshCommand } from './controller/commands/refreshCommand';
import { runCommand } from './controller/commands/runCommand';
import { runWithOptionsCommand } from './controller/commands/runWithOptionsCommand';
import { showDiffCommand } from './controller/commands/showDiffCommand';
import { showResultsNotFoundErrorCommand } from './controller/commands/showResultsNotFoundErrorCommand';
import { showVisualizerCommand } from './controller/commands/showVisualizerCommand';
import {
	switchToExecutionCommand,
	switchToSeedCommand,
} from './controller/commands/switchModeCommand';
import { ComparisonViewController } from './controller/comparisonViewController';
import { InitializationWebViewProvider } from './controller/initializationWebViewProvider';
import { PahcerTreeViewController } from './controller/pahcerTreeViewController';
import { RunOptionsWebViewProvider } from './controller/runOptionsWebViewProvider';
import { VisualizerViewController } from './controller/visualizerViewController';
import { ContextAdapter } from './infrastructure/contextAdapter';
import { ExecutionRepository } from './infrastructure/executionRepository';
import { OutputFileRepository } from './infrastructure/outputFileRepository';
import { PahcerAdapter, PahcerStatus } from './infrastructure/pahcerAdapter';
import { TaskAdapter } from './infrastructure/taskAdapter';
import { WorkspaceAdapter } from './infrastructure/workspaceAdapter';

/**
 * アダプター（インフラ層コンポーネント）の集合
 */
interface Adapters {
	workspaceAdapter: WorkspaceAdapter;
	contextAdapter: ContextAdapter;
	taskAdapter: TaskAdapter;
	executionRepository: ExecutionRepository;
	outputFileRepository: OutputFileRepository;
}

/**
 * コントローラー（ビューコントローラー）の集合
 */
interface Controllers {
	treeViewController: PahcerTreeViewController;
	visualizerViewController: VisualizerViewController;
	comparisonViewController: ComparisonViewController;
}

/**
 * すべてのアダプターを初期化
 */
async function initializeAdapters(workspaceRoot: string): Promise<Adapters> {
	const workspaceAdapter = new WorkspaceAdapter();
	const contextAdapter = new ContextAdapter();
	const taskAdapter = new TaskAdapter();
	const executionRepository = new ExecutionRepository(workspaceRoot);
	const outputFileRepository = new OutputFileRepository(workspaceRoot);

	// Check pahcer installation and initialization status
	const pahcerAdapter = new PahcerAdapter(workspaceRoot);
	const pahcerStatus = pahcerAdapter.checkStatus();

	// Set context for viewsWelcome
	await contextAdapter.setPahcerStatus(pahcerStatus);
	await contextAdapter.setShowInitialization(false);

	return {
		workspaceAdapter,
		contextAdapter,
		taskAdapter,
		executionRepository,
		outputFileRepository,
	};
}

/**
 * コントローラーを初期化
 */
function initializeControllers(
	context: vscode.ExtensionContext,
	workspaceRoot: string,
): Controllers {
	const treeViewController = new PahcerTreeViewController(workspaceRoot);
	const visualizerViewController = new VisualizerViewController(context, workspaceRoot);
	const comparisonViewController = new ComparisonViewController(context, workspaceRoot);

	return {
		treeViewController,
		visualizerViewController,
		comparisonViewController,
	};
}

/**
 * 初期化ビューを登録
 */
function registerInitializationView(
	context: vscode.ExtensionContext,
	workspaceRoot: string,
	adapters: Adapters,
): vscode.Disposable {
	const initializationProvider = new InitializationWebViewProvider(
		context,
		workspaceRoot,
		adapters.taskAdapter,
		adapters.contextAdapter,
	);

	return vscode.window.registerWebviewViewProvider('pahcerInitialization', initializationProvider);
}

/**
 * TreeViewを登録
 */
async function registerTreeView(
	workspaceRoot: string,
	controllers: Controllers,
	adapters: Adapters,
): Promise<vscode.TreeView<unknown>> {
	const pahcerAdapter = new PahcerAdapter(workspaceRoot);
	const pahcerStatus = pahcerAdapter.checkStatus();

	const treeView = vscode.window.createTreeView('pahcerResults', {
		treeDataProvider: controllers.treeViewController,
		showCollapseAll: pahcerStatus === PahcerStatus.Ready,
		canSelectMany: false,
	});

	// Initialize grouping context
	const updateGroupingContext = async () => {
		const mode = controllers.treeViewController.getGroupingMode();
		await adapters.contextAdapter.setGroupingMode(mode);
	};
	await updateGroupingContext();

	// Handle checkbox state changes
	treeView.onDidChangeCheckboxState(async (e) => {
		for (const [item] of e.items) {
			if (item.executionId) {
				controllers.treeViewController.toggleCheckbox(item.executionId);
			}
		}

		// Auto-show comparison view when checkboxes change
		const checkedResults = controllers.treeViewController.getCheckedResults();
		await controllers.comparisonViewController.showComparison(checkedResults);

		// Update context for diff button visibility
		const resultsWithCommitHash =
			await controllers.treeViewController.getCheckedResultsWithCommitHash();
		await adapters.contextAdapter.setCanShowDiff(resultsWithCommitHash.length === 2);
	});

	return treeView;
}

/**
 * 実行オプションビューを登録
 */
function registerRunOptionsView(
	context: vscode.ExtensionContext,
	workspaceRoot: string,
	adapters: Adapters,
): vscode.Disposable {
	const runOptionsWebViewProvider = new RunOptionsWebViewProvider(
		context,
		workspaceRoot,
		adapters.taskAdapter,
		adapters.outputFileRepository,
		adapters.executionRepository,
		adapters.contextAdapter,
	);

	// Initialize context (show TreeView by default)
	adapters.contextAdapter.setShowRunOptions(false);

	return vscode.window.registerWebviewViewProvider('pahcerRunOptions', runOptionsWebViewProvider);
}

/**
 * すべてのコマンドを登録
 */
function registerCommands(
	workspaceRoot: string,
	adapters: Adapters,
	controllers: Controllers,
): vscode.Disposable[] {
	// Initialize grouping context update function
	const updateGroupingContext = async () => {
		const mode = controllers.treeViewController.getGroupingMode();
		await adapters.contextAdapter.setGroupingMode(mode);
	};

	return [
		vscode.commands.registerCommand('pahcer-ui.openGitHub', openGitHubCommand()),
		vscode.commands.registerCommand(
			'pahcer-ui.initialize',
			initializeCommand(adapters.contextAdapter),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.refresh',
			refreshCommand(controllers.treeViewController),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.run',
			runCommand(
				adapters.workspaceAdapter,
				adapters.taskAdapter,
				adapters.outputFileRepository,
				adapters.executionRepository,
				controllers.treeViewController,
			),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.runWithOptions',
			runWithOptionsCommand(adapters.contextAdapter),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.changeSortOrder',
			changeSortOrderCommand(controllers.treeViewController),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.switchToSeed',
			switchToSeedCommand(controllers.treeViewController, updateGroupingContext),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.switchToExecution',
			switchToExecutionCommand(controllers.treeViewController, updateGroupingContext),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.showVisualizer',
			showVisualizerCommand(controllers.visualizerViewController),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.showResultsNotFoundError',
			showResultsNotFoundErrorCommand(),
		),
		vscode.commands.registerCommand(
			'pahcer-ui.addComment',
			addCommentCommand(adapters.executionRepository, controllers.treeViewController),
		),
		vscode.commands.registerCommand('pahcer-ui.openInputFile', openInputFileCommand(workspaceRoot)),
		vscode.commands.registerCommand(
			'pahcer-ui.openOutputFile',
			openOutputFileCommand(workspaceRoot),
		),
		vscode.commands.registerCommand('pahcer-ui.openErrorFile', openErrorFileCommand(workspaceRoot)),
		vscode.commands.registerCommand(
			'pahcer-ui.showDiff',
			showDiffCommand(controllers.treeViewController, workspaceRoot),
		),
	];
}

export async function activate(context: vscode.ExtensionContext) {
	// Step 1: Get workspace root
	const workspaceAdapter = new WorkspaceAdapter();
	const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

	if (!workspaceRoot) {
		return;
	}

	// Step 2: Initialize all adapters
	const adapters = await initializeAdapters(workspaceRoot);

	// Step 3: Initialize all controllers
	const controllers = initializeControllers(context, workspaceRoot);

	// Step 4: Register all views
	const initializationView = registerInitializationView(context, workspaceRoot, adapters);
	const treeView = await registerTreeView(workspaceRoot, controllers, adapters);
	const runOptionsView = registerRunOptionsView(context, workspaceRoot, adapters);

	// Step 5: Register all commands
	const commands = registerCommands(workspaceRoot, adapters, controllers);

	// Step 6: Add all disposables to context
	context.subscriptions.push(initializationView, treeView, runOptionsView, ...commands);
}

export function deactivate() {}
