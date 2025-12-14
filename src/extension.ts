import * as vscode from 'vscode';
import { CommitResultsUseCase } from './application/commitResultsUseCase';
import { InitializeUseCase } from './application/initializeUseCase';
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
import { PahcerAdapter } from './infrastructure/pahcerAdapter';
import { PahcerConfigRepository } from './infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from './infrastructure/testCaseRepository';
import { TesterDownloader } from './infrastructure/testerDownloader';
import { UIConfigRepository } from './infrastructure/uiConfigRepository';
import { VisualizerCache } from './infrastructure/visualizerCache';
import { VisualizerDownloader } from './infrastructure/visualizerDownloader';
import { AppUIConfig } from './presentation/appUIConfig';
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
import { VSCodeUIContext } from './presentation/vscodeUIContext';

/**
 * アダプター（インフラ層コンポーネント）の集合
 */
interface Adapters {
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
  initializeUseCase: InitializeUseCase;
}

/**
 * すべてのアダプターを初期化
 */
async function initializeAdapters(workspaceRoot: string): Promise<Adapters> {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const fileAnalyzer = new FileAnalyzer();
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const pahcerConfigRepository: IPahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const gitignoreAdapter = new GitignoreAdapter(workspaceRoot);
  const gitAdapter = new GitAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const uiConfigRepository = new UIConfigRepository(workspaceRoot);
  const visualizerDir = `${workspaceRoot}/.pahcer-ui/visualizer`;
  const visualizerDownloader = new VisualizerDownloader(visualizerDir);
  const visualizerCache = new VisualizerCache(visualizerDir);
  const testerDownloader = new TesterDownloader(workspaceRoot);
  const pahcerAdapter = new PahcerAdapter(pahcerConfigRepository, workspaceRoot);

  return {
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

  const initializeUseCase = new InitializeUseCase(
    adapters.testerDownloader,
    adapters.gitignoreAdapter,
    adapters.pahcerAdapter,
    adapters.pahcerConfigRepository,
  );

  return {
    commitResultsUseCase,
    runPahcerUseCase,
    loadPahcerTreeDataUseCase,
    initializeUseCase,
  };
}

/**
 * コントローラーを初期化
 */
function initializeControllers(
  context: vscode.ExtensionContext,
  appUIConfig: AppUIConfig,
  adapters: Adapters,
  useCases: UseCases,
): Controllers {
  const treeViewController = new PahcerTreeViewController(
    appUIConfig,
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
  vscodeUIContext: VSCodeUIContext,
  useCases: UseCases,
): vscode.Disposable {
  const webViewController = new InitializationWebViewController(
    context,
    vscodeUIContext,
    useCases.initializeUseCase,
  );

  return vscode.window.registerWebviewViewProvider('pahcerInitialization', webViewController);
}

/**
 * TreeViewを登録
 */
async function registerTreeView(
  appUIConfig: AppUIConfig,
  vscodeUIContext: VSCodeUIContext,
  controllers: Controllers,
): Promise<vscode.TreeView<unknown>> {
  const treeView = vscode.window.createTreeView('pahcerResults', {
    treeDataProvider: controllers.treeViewController,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // グループモードを初期化する
  const mode = await appUIConfig.groupingMode();
  await vscodeUIContext.setGroupingMode(mode);

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
    await vscodeUIContext.setCanShowDiff(resultsWithCommitHash.length === 2);
  });

  return treeView;
}

/**
 * 実行オプションビューを登録
 */
function registerRunOptionsView(
  context: vscode.ExtensionContext,
  vscodeUIContext: VSCodeUIContext,
  useCases: UseCases,
): vscode.Disposable {
  const runOptionsWebViewProvider = new RunOptionsWebViewController(
    context,
    vscodeUIContext,
    useCases.runPahcerUseCase,
  );

  // Initialize context (show TreeView by default)
  vscodeUIContext.setShowRunOptions(false);

  return vscode.window.registerWebviewViewProvider('pahcerRunOptions', runOptionsWebViewProvider);
}

/**
 * すべてのコマンドを登録
 */
function registerCommands(
  appUIConfig: AppUIConfig,
  vscodeUIContext: VSCodeUIContext,
  adapters: Adapters,
  controllers: Controllers,
  useCases: UseCases,
): vscode.Disposable[] {
  // Initialize grouping context update function
  const updateGroupingContext = async () => {
    const mode = await appUIConfig.groupingMode();
    await vscodeUIContext.setGroupingMode(mode);
  };

  return [
    vscode.commands.registerCommand('pahcer-ui.openGitHub', openGitHubCommand()),
    vscode.commands.registerCommand('pahcer-ui.initialize', initializeCommand(vscodeUIContext)),
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
      runWithOptionsCommand(vscodeUIContext),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.changeSortOrder',
      changeSortOrderCommand(appUIConfig, controllers.treeViewController),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.switchToSeed',
      switchToSeedCommand(appUIConfig, controllers.treeViewController, updateGroupingContext),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.switchToExecution',
      switchToExecutionCommand(appUIConfig, controllers.treeViewController, updateGroupingContext),
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
  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    return;
  }

  // Initialize all adapters
  const adapters = await initializeAdapters(workspaceRoot);

  // UI を初期化する
  const appUIConfig = new AppUIConfig();
  const vscodeUIContext = new VSCodeUIContext();
  await vscodeUIContext.setPahcerStatus(await adapters.pahcerAdapter.checkStatus());
  await vscodeUIContext.setShowInitialization(false);

  // Initialize all use cases
  const useCases = initializeUseCases(adapters);

  // Initialize all controllers
  const controllers = initializeControllers(context, appUIConfig, adapters, useCases);

  // Register all views
  const initializationView = registerInitializationView(context, vscodeUIContext, useCases);
  const treeView = await registerTreeView(appUIConfig, vscodeUIContext, controllers);
  const runOptionsView = registerRunOptionsView(context, vscodeUIContext, useCases);

  // Register all commands
  const commands = registerCommands(appUIConfig, vscodeUIContext, adapters, controllers, useCases);

  // Add all disposables to context
  context.subscriptions.push(initializationView, treeView, runOptionsView, ...commands);
}

export function deactivate() {}
