import * as vscode from 'vscode';
import { CommitResultsUseCase } from './application/commitResultsUseCase';
import { LoadPahcerTreeDataUseCase } from './application/loadPahcerTreeDataUseCase';
import { RunPahcerUseCase } from './application/runPahcerUseCase';
import type { IExecutionRepository } from './domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from './domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from './domain/interfaces/ITestCaseRepository';
import type { IUIConfigRepository } from './domain/interfaces/IUIConfigRepository';
import { ExecutionRepository } from './infrastructure/executionRepository';
import { FileAnalyzer } from './infrastructure/fileAnalyzer';
import { GitAdapter } from './infrastructure/gitAdapter';
import { GitignoreAdapter } from './infrastructure/gitignoreAdapter';
import { InOutFilesAdapter } from './infrastructure/inOutFilesAdapter';
import { KeybindingContextAdapter } from './infrastructure/keybindingContextAdapter';
import { PahcerAdapter, PahcerStatus } from './infrastructure/pahcerAdapter';
import { PahcerConfigRepository } from './infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from './infrastructure/testCaseRepository';
import { TesterDownloader } from './infrastructure/testerDownloader';
import { UIConfigRepository } from './infrastructure/uiConfigRepository';
import { VisualizerCache } from './infrastructure/visualizerCache';
import { VisualizerDownloader } from './infrastructure/visualizerDownloader';
import { addCommentCommand } from './presentation/controller/commands/addCommentCommand';
import { changeSortOrderCommand } from './presentation/controller/commands/changeSortOrderCommand';
import { initializeCommand } from './presentation/controller/commands/initializeCommand';
import {
  openErrorFileCommand,
  openInputFileCommand,
  openOutputFileCommand,
} from './presentation/controller/commands/openFileCommand';
import { openGitHubCommand } from './presentation/controller/commands/openGitHubCommand';
import { refreshCommand } from './presentation/controller/commands/refreshCommand';
import { runCommand } from './presentation/controller/commands/runCommand';
import { runWithOptionsCommand } from './presentation/controller/commands/runWithOptionsCommand';
import { showDiffCommand } from './presentation/controller/commands/showDiffCommand';
import { showResultsNotFoundErrorCommand } from './presentation/controller/commands/showResultsNotFoundErrorCommand';
import { showVisualizerCommand } from './presentation/controller/commands/showVisualizerCommand';
import {
  switchToExecutionCommand,
  switchToSeedCommand,
} from './presentation/controller/commands/switchModeCommand';
import { ComparisonViewController } from './presentation/controller/comparisonViewController';
import { InitializationWebViewController } from './presentation/controller/initializationWebViewController';
import { PahcerTreeViewController } from './presentation/controller/pahcerTreeViewController';
import { RunOptionsWebViewController } from './presentation/controller/runOptionsWebViewController';
import { VisualizerViewController } from './presentation/controller/visualizerViewController';
import { TreeItemBuilder } from './presentation/view/treeView/treeItemBuilder';

/**
 * アダプター（インフラ層コンポーネント）の集合
 */
interface Adapters {
  keybindingContextAdapter: KeybindingContextAdapter;
  pahcerAdapter: PahcerAdapter;
  executionRepository: IExecutionRepository;
  fileAnalyzer: FileAnalyzer;
  inOutFilesAdapter: InOutFilesAdapter;
  pahcerConfigRepository: IPahcerConfigRepository;
  gitignoreAdapter: GitignoreAdapter;
  gitAdapter: GitAdapter;
  testCaseRepository: ITestCaseRepository;
  testerDownloader: TesterDownloader;
  uiConfigRepository: IUIConfigRepository;
  visualizerCache: VisualizerCache;
  visualizerDownloader: VisualizerDownloader;
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
 * ユースケース層の集合
 */
interface UseCases {
  commitResultsUseCase: CommitResultsUseCase;
  runPahcerUseCase: RunPahcerUseCase;
  loadPahcerTreeDataUseCase: LoadPahcerTreeDataUseCase;
}

/**
 * すべてのアダプターを初期化
 */
async function initializeAdapters(workspaceRoot: string): Promise<Adapters> {
  const keybindingContextAdapter = new KeybindingContextAdapter();
  const executionRepository: IExecutionRepository = new ExecutionRepository(workspaceRoot);
  const fileAnalyzer = new FileAnalyzer();
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const pahcerConfigRepository: IPahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const gitignoreAdapter = new GitignoreAdapter(workspaceRoot);
  const gitAdapter = new GitAdapter(workspaceRoot);
  const testCaseRepository: ITestCaseRepository = new TestCaseRepository(
    inOutFilesAdapter,
    workspaceRoot,
  );
  const uiConfigRepository: IUIConfigRepository = new UIConfigRepository(workspaceRoot);
  const visualizerDir = `${workspaceRoot}/.pahcer-ui/visualizer`;
  const visualizerDownloader = new VisualizerDownloader(visualizerDir);
  const visualizerCache = new VisualizerCache(visualizerDir);
  const testerDownloader = new TesterDownloader(workspaceRoot);

  // Create slim PahcerAdapter (infrastructure-only)
  const pahcerAdapter = new PahcerAdapter(pahcerConfigRepository, workspaceRoot);

  const pahcerStatus = await pahcerAdapter.checkStatus();

  // Set context for viewsWelcome
  await keybindingContextAdapter.setPahcerStatus(pahcerStatus);
  await keybindingContextAdapter.setShowInitialization(false);

  return {
    keybindingContextAdapter,
    pahcerAdapter,
    executionRepository,
    fileAnalyzer,
    inOutFilesAdapter,
    pahcerConfigRepository,
    gitignoreAdapter,
    gitAdapter,
    testCaseRepository,
    testerDownloader,
    uiConfigRepository,
    visualizerCache,
    visualizerDownloader,
  };
}

/**
 * ユースケースを初期化
 */
function initializeUseCases(adapters: Adapters): UseCases {
  const commitResultsUseCase = new CommitResultsUseCase(adapters.gitAdapter);

  const runPahcerUseCase = new RunPahcerUseCase(
    adapters.pahcerAdapter,
    commitResultsUseCase,
    adapters.inOutFilesAdapter,
    adapters.fileAnalyzer,
    adapters.executionRepository,
    adapters.testCaseRepository,
    adapters.pahcerConfigRepository,
  );

  const loadPahcerTreeDataUseCase = new LoadPahcerTreeDataUseCase(
    adapters.executionRepository,
    adapters.testCaseRepository,
    adapters.pahcerConfigRepository,
  );

  return {
    commitResultsUseCase,
    runPahcerUseCase,
    loadPahcerTreeDataUseCase,
  };
}

/**
 * コントローラーを初期化
 */
function initializeControllers(
  context: vscode.ExtensionContext,
  adapters: Adapters,
  useCases: UseCases,
): Controllers {
  const treeViewController = new PahcerTreeViewController(
    adapters.pahcerAdapter,
    useCases.loadPahcerTreeDataUseCase,
    adapters.executionRepository,
    new TreeItemBuilder(),
  );
  const visualizerViewController = new VisualizerViewController(
    context,
    adapters.inOutFilesAdapter,
    adapters.executionRepository,
    adapters.visualizerDownloader,
    adapters.visualizerCache,
  );
  const comparisonViewController = new ComparisonViewController(
    context,
    adapters.executionRepository,
    adapters.testCaseRepository,
    adapters.uiConfigRepository,
    adapters.pahcerConfigRepository,
  );

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
  const initializationProvider = new InitializationWebViewController(
    context,
    workspaceRoot,
    adapters.pahcerAdapter,
    adapters.keybindingContextAdapter,
    adapters.gitignoreAdapter,
    adapters.testerDownloader,
  );

  return vscode.window.registerWebviewViewProvider('pahcerInitialization', initializationProvider);
}

/**
 * TreeViewを登録
 */
async function registerTreeView(
  controllers: Controllers,
  adapters: Adapters,
): Promise<vscode.TreeView<unknown>> {
  const pahcerStatus = await adapters.pahcerAdapter.checkStatus();

  const treeView = vscode.window.createTreeView('pahcerResults', {
    treeDataProvider: controllers.treeViewController,
    showCollapseAll: pahcerStatus === PahcerStatus.Ready,
    canSelectMany: false,
  });

  // Initialize grouping context
  const updateGroupingContext = async () => {
    const mode = controllers.treeViewController.getGroupingMode();
    await adapters.keybindingContextAdapter.setGroupingMode(mode);
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
    await adapters.keybindingContextAdapter.setCanShowDiff(resultsWithCommitHash.length === 2);
  });

  return treeView;
}

/**
 * 実行オプションビューを登録
 */
function registerRunOptionsView(
  context: vscode.ExtensionContext,
  useCases: UseCases,
  adapters: Adapters,
): vscode.Disposable {
  const runOptionsWebViewProvider = new RunOptionsWebViewController(
    context,
    useCases.runPahcerUseCase,
    adapters.keybindingContextAdapter,
  );

  // Initialize context (show TreeView by default)
  adapters.keybindingContextAdapter.setShowRunOptions(false);

  return vscode.window.registerWebviewViewProvider('pahcerRunOptions', runOptionsWebViewProvider);
}

/**
 * すべてのコマンドを登録
 */
function registerCommands(
  adapters: Adapters,
  controllers: Controllers,
  useCases: UseCases,
): vscode.Disposable[] {
  // Initialize grouping context update function
  const updateGroupingContext = async () => {
    const mode = controllers.treeViewController.getGroupingMode();
    await adapters.keybindingContextAdapter.setGroupingMode(mode);
  };

  return [
    vscode.commands.registerCommand('pahcer-ui.openGitHub', openGitHubCommand()),
    vscode.commands.registerCommand(
      'pahcer-ui.initialize',
      initializeCommand(adapters.keybindingContextAdapter),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.refresh',
      refreshCommand(controllers.treeViewController),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.run',
      runCommand(useCases.runPahcerUseCase, controllers.treeViewController),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.runWithOptions',
      runWithOptionsCommand(adapters.keybindingContextAdapter),
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
    vscode.commands.registerCommand(
      'pahcer-ui.openInputFile',
      openInputFileCommand(adapters.inOutFilesAdapter),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.openOutputFile',
      openOutputFileCommand(adapters.inOutFilesAdapter),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.openErrorFile',
      openErrorFileCommand(adapters.inOutFilesAdapter),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.showDiff',
      showDiffCommand(controllers.treeViewController, adapters.gitAdapter),
    ),
  ];
}

export async function activate(context: vscode.ExtensionContext) {
  // Step 1: Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    return;
  }

  // Step 2: Initialize all adapters
  const adapters = await initializeAdapters(workspaceRoot);

  // Step 3: Initialize all use cases
  const useCases = initializeUseCases(adapters);

  // Step 4: Initialize all controllers
  const controllers = initializeControllers(context, adapters, useCases);

  // Step 5: Register all views
  const initializationView = registerInitializationView(context, workspaceRoot, adapters);
  const treeView = await registerTreeView(controllers, adapters);
  const runOptionsView = registerRunOptionsView(context, useCases, adapters);

  // Step 6: Register all commands
  const commands = registerCommands(adapters, controllers, useCases);

  // Step 7: Add all disposables to context
  context.subscriptions.push(initializationView, treeView, runOptionsView, ...commands);
}

export function deactivate() {}
