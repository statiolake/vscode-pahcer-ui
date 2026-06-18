import * as vscode from 'vscode';
import { CheckPahcerStatusUseCase } from './application/checkPahcerStatusUseCase';
import { CommitResultsUseCase } from './application/commitResultsUseCase';
import { CopySourceAtExecutionUseCase } from './application/copySourceAtExecutionUseCase';
import { InitializeUseCase } from './application/initializeUseCase';
import { LoadComparisonDataUseCase } from './application/loadComparisonDataUseCase';
import { LoadPahcerTreeDataUseCase } from './application/loadPahcerTreeDataUseCase';
import { OpenCaseFileUseCase } from './application/openCaseFileUseCase';
import type { ITestCaseSummaryQueryService } from './application/queryServices/testCaseSummaryQueryService';
import type { IComparisonConfigRepository } from './application/repositories/IComparisonConfigRepository';
import { RunPahcerUseCase } from './application/runPahcerUseCase';
import { ShowExecutionDiffUseCase } from './application/showExecutionDiffUseCase';
import { UpdateExecutionCommentUseCase } from './application/updateExecutionCommentUseCase';
import { VisualizerUseCase } from './application/visualizerUseCase';
import type { IExecutionRepository } from './domain/interfaces/IExecutionRepository';
import type { IPahcerConfigRepository } from './domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from './domain/interfaces/ITestCaseRepository';
import { ComparisonConfigRepository } from './infrastructure/comparisonConfigRepository';
import { ExecutionRepository } from './infrastructure/executionRepository';
import { FileAnalyzer } from './infrastructure/fileAnalyzer';
import { GitAdapter } from './infrastructure/gitAdapter';
import { GitignoreAdapter } from './infrastructure/gitignoreAdapter';
import { InOutFilesAdapter } from './infrastructure/inOutFilesAdapter';
import { PahcerAdapter } from './infrastructure/pahcerAdapter';
import { PahcerConfigRepository } from './infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from './infrastructure/testCaseRepository';
import { TestCaseSummaryQueryService } from './infrastructure/testCaseSummaryQueryService';
import { TesterDownloader } from './infrastructure/testerDownloader';
import { VisualizerAdapter } from './infrastructure/visualizerAdapter';
import { AppUIConfig } from './presentation/appUIConfig';
import { addCommentCommand } from './presentation/controller/commands/addCommentCommand';
import { changeSortOrderCommand } from './presentation/controller/commands/changeSortOrderCommand';
import { copySourceCommand } from './presentation/controller/commands/copySourceCommand';
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
  testCaseSummaryQueryService: ITestCaseSummaryQueryService;
  testerDownloader: TesterDownloader;
  comparisonConfigRepository: IComparisonConfigRepository;
  visualizerAdapter: VisualizerAdapter;
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
  loadComparisonDataUseCase: LoadComparisonDataUseCase;
  initializeUseCase: InitializeUseCase;
  checkPahcerStatusUseCase: CheckPahcerStatusUseCase;
  updateExecutionCommentUseCase: UpdateExecutionCommentUseCase;
  openCaseFileUseCase: OpenCaseFileUseCase;
  copySourceAtExecutionUseCase: CopySourceAtExecutionUseCase;
  showExecutionDiffUseCase: ShowExecutionDiffUseCase;
  visualizerUseCase: VisualizerUseCase;
}

/**
 * すべてのアダプターを初期化
 */
async function initializeAdapters(workspaceRoot: string): Promise<Adapters> {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const fileAnalyzer = new FileAnalyzer();
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const gitignoreAdapter = new GitignoreAdapter(workspaceRoot);
  const gitAdapter = new GitAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const testCaseSummaryQueryService = new TestCaseSummaryQueryService(workspaceRoot);
  const comparisonConfigRepository = new ComparisonConfigRepository(workspaceRoot);
  const visualizerAdapter = new VisualizerAdapter(workspaceRoot);
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
    testCaseSummaryQueryService,
    testerDownloader,
    comparisonConfigRepository,
    visualizerAdapter,
  };
}

/**
 * ユースケースを初期化
 */
function initializeUseCases(
  adapters: Adapters,
  workspaceName: string,
  appUIConfig: AppUIConfig,
): UseCases {
  const commitResultsUseCase = new CommitResultsUseCase(adapters.gitAdapter, appUIConfig);

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
    adapters.testCaseSummaryQueryService,
    adapters.pahcerConfigRepository,
  );
  const loadComparisonDataUseCase = new LoadComparisonDataUseCase(
    adapters.executionRepository,
    adapters.testCaseRepository,
    adapters.comparisonConfigRepository,
    adapters.pahcerConfigRepository,
  );

  const initializeUseCase = new InitializeUseCase(
    adapters.testerDownloader,
    adapters.gitignoreAdapter,
    adapters.pahcerAdapter,
    adapters.pahcerConfigRepository,
    workspaceName,
  );
  const checkPahcerStatusUseCase = new CheckPahcerStatusUseCase(adapters.pahcerAdapter);
  const updateExecutionCommentUseCase = new UpdateExecutionCommentUseCase(
    adapters.executionRepository,
  );
  const openCaseFileUseCase = new OpenCaseFileUseCase(adapters.inOutFilesAdapter);
  const copySourceAtExecutionUseCase = new CopySourceAtExecutionUseCase(
    adapters.executionRepository,
    adapters.gitAdapter,
  );
  const showExecutionDiffUseCase = new ShowExecutionDiffUseCase(
    adapters.executionRepository,
    adapters.gitAdapter,
  );
  const visualizerUseCase = new VisualizerUseCase(
    adapters.inOutFilesAdapter,
    adapters.executionRepository,
    adapters.visualizerAdapter,
  );

  return {
    commitResultsUseCase,
    runPahcerUseCase,
    loadPahcerTreeDataUseCase,
    loadComparisonDataUseCase,
    initializeUseCase,
    checkPahcerStatusUseCase,
    updateExecutionCommentUseCase,
    openCaseFileUseCase,
    copySourceAtExecutionUseCase,
    showExecutionDiffUseCase,
    visualizerUseCase,
  };
}

/**
 * コントローラーを初期化
 */
function initializeControllers(
  context: vscode.ExtensionContext,
  appUIConfig: AppUIConfig,
  useCases: UseCases,
): Controllers {
  const treeViewController = new PahcerTreeViewController(
    appUIConfig,
    useCases.checkPahcerStatusUseCase,
    useCases.loadPahcerTreeDataUseCase,
    new TreeItemBuilder(),
  );
  const visualizerViewController = new VisualizerViewController(
    context,
    useCases.visualizerUseCase,
  );
  const comparisonViewController = new ComparisonViewController(
    context,
    useCases.loadComparisonDataUseCase,
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
  useCases: UseCases,
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
    await vscodeUIContext.setCanShowDiff(
      await useCases.showExecutionDiffUseCase.canShowDiff(checkedResults),
    );
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
      addCommentCommand(useCases.updateExecutionCommentUseCase, controllers.treeViewController),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.openInputFile',
      openInputFileCommand(useCases.openCaseFileUseCase),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.openOutputFile',
      openOutputFileCommand(useCases.openCaseFileUseCase),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.openErrorFile',
      openErrorFileCommand(useCases.openCaseFileUseCase),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.showDiff',
      showDiffCommand(controllers.treeViewController, useCases.showExecutionDiffUseCase),
    ),
    vscode.commands.registerCommand(
      'pahcer-ui.copySource',
      copySourceCommand(useCases.copySourceAtExecutionUseCase),
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
  await vscodeUIContext.setShowInitialization(false);

  // Initialize all use cases
  const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? '';
  const useCases = initializeUseCases(adapters, workspaceName, appUIConfig);
  await vscodeUIContext.setPahcerStatus(await useCases.checkPahcerStatusUseCase.check());

  // Initialize all controllers
  const controllers = initializeControllers(context, appUIConfig, useCases);

  // Register all views
  const initializationView = registerInitializationView(context, vscodeUIContext, useCases);
  const treeView = await registerTreeView(appUIConfig, vscodeUIContext, controllers, useCases);
  const runOptionsView = registerRunOptionsView(context, vscodeUIContext, useCases);

  // Register all commands
  const commands = registerCommands(appUIConfig, vscodeUIContext, controllers, useCases);

  // Add all disposables to context
  context.subscriptions.push(initializationView, treeView, runOptionsView, ...commands);
}

export function deactivate() {}
