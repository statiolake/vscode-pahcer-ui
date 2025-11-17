import * as vscode from 'vscode';
import { type Execution, getLongTitle } from '../../domain/models/execution';
import { calculateBestScoresFromTestCases } from '../../domain/services/aggregationService';
import { ExecutionRepository } from '../../infrastructure/executionRepository';
import { InOutFilesAdapter } from '../../infrastructure/inOutFilesAdapter';
import { PahcerConfigRepository } from '../../infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from '../../infrastructure/testCaseRepository';
import { UIConfigRepository } from '../../infrastructure/uiConfigRepository';

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * 比較ビューのコントローラ
 */
export class ComparisonViewController {
  private panel: vscode.WebviewPanel | undefined;
  private messageDisposable: vscode.Disposable | undefined;

  private executionRepository: ExecutionRepository;
  private testCaseRepository: TestCaseRepository;
  private uiConfigRepository: UIConfigRepository;
  private pahcerConfigRepository: PahcerConfigRepository;

  constructor(
    private context: vscode.ExtensionContext,
    workspaceRoot: string,
  ) {
    this.executionRepository = new ExecutionRepository(workspaceRoot);
    const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
    this.testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
    this.uiConfigRepository = new UIConfigRepository(workspaceRoot);
    this.pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  }

  /**
   * 比較ビューを表示
   */
  async showComparison(executionIds: string[]): Promise<void> {
    // Load execution data
    const executions: Execution[] = [];
    for (const executionId of executionIds) {
      try {
        const execution = await this.executionRepository.findById(executionId);
        if (execution) {
          executions.push(execution);
        }
      } catch (error) {
        console.error(`Failed to load execution ${executionId}:`, error);
      }
    }

    if (executions.length === 0) {
      // Close panel if no results selected
      if (this.panel) {
        this.panel.dispose();
      }
      return;
    }

    try {
      const comparisonData = await this.prepareComparisonData(executions);

      // Create or update panel
      if (this.panel) {
        // Panel already exists - just update data without reloading
        this.panel.reveal(vscode.ViewColumn.One);
        this.panel.webview.postMessage({
          command: 'updateData',
          data: comparisonData,
        });
      } else {
        // Create new panel
        const extensionUri = this.context.extensionUri;

        this.panel = vscode.window.createWebviewPanel(
          'pahcerComparison',
          '結果の比較',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
          },
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
          if (this.messageDisposable) {
            this.messageDisposable.dispose();
            this.messageDisposable = undefined;
          }
        });

        // Handle messages from webview
        this.messageDisposable = this.panel.webview.onDidReceiveMessage(
          async (message) => {
            if (message.command === 'showVisualizer') {
              const { resultId, seed } = message;
              await vscode.commands.executeCommand('pahcer-ui.showVisualizer', seed, resultId);
            } else if (message.command === 'saveComparisonConfig') {
              await this.uiConfigRepository.upsert(message.config);
            }
          },
          undefined,
          this.context.subscriptions,
        );

        // Set initial HTML
        this.panel.webview.html = this.getWebviewContent(comparisonData, this.panel.webview);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `比較データの準備に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 比較データを準備
   */
  private async prepareComparisonData(executions: Execution[]) {
    // Load test cases for selected executions
    const testCasesArray = await Promise.all(
      executions.map((exec) => this.testCaseRepository.findByExecutionId(exec.id)),
    );
    const testCases = testCasesArray.flat();
    const pahcerConfig = await this.pahcerConfigRepository.findById('normal');
    if (!pahcerConfig) {
      throw new Error('pahcer設定が見つかりません');
    }

    // Calculate best scores
    const bestScores = calculateBestScoresFromTestCases(testCases, pahcerConfig.objective);

    // Collect all seeds for selected executions
    const allSeeds = new Set<number>();
    for (const testCase of testCases) {
      allSeeds.add(testCase.id.seed);
    }
    const seeds = Array.from(allSeeds).sort((a, b) => a - b);

    // Build inputData and stderrData from TestCase analysis fields
    const inputDataObj: Record<number, string> = {};
    const stderrData: Record<string, Record<number, Record<string, number>>> = {};

    for (const execution of executions) {
      stderrData[execution.id] = {};

      // Get test cases for this execution
      const executionTestCases = testCases.filter((tc) => tc.id.executionId === execution.id);

      for (const testCase of executionTestCases) {
        const seed = testCase.id.seed;

        // Use analysis data from TestCase object
        if (testCase.firstInputLine !== undefined) {
          // Use first input line from test case analysis
          if (!inputDataObj[seed]) {
            inputDataObj[seed] = testCase.firstInputLine || '';
          }

          // Use stderr variables from test case analysis
          stderrData[execution.id][seed] = testCase.stderrVars || {};
        } else {
          // Fallback to empty if analysis data not available
          if (!inputDataObj[seed]) {
            inputDataObj[seed] = '';
          }
          stderrData[execution.id][seed] = {};
        }
      }
    }

    // Load config
    const config = await this.uiConfigRepository.find();

    // Prepare data for React
    return {
      results: executions.map((execution) => ({
        id: execution.id,
        time: getLongTitle(execution),
        cases: testCases
          .filter((tc) => tc.id.executionId === execution.id)
          .map((tc) => {
            // Calculate relative score
            const bestScore = bestScores.get(tc.id.seed);
            let relativeScore = 0;
            if (tc.score > 0 && bestScore !== undefined) {
              if (pahcerConfig.objective === 'max') {
                relativeScore = (tc.score / bestScore) * 100;
              } else {
                relativeScore = (bestScore / tc.score) * 100;
              }
            }

            return {
              seed: tc.id.seed,
              score: tc.score,
              relativeScore,
              executionTime: tc.executionTime,
            };
          }),
      })),
      seeds,
      inputData: inputDataObj,
      stderrData,
      config,
    };
  }

  /**
   * WebViewのHTMLを生成
   */
  private getWebviewContent(
    comparisonData: Awaited<ReturnType<typeof this.prepareComparisonData>>,
    webview: vscode.Webview,
  ): string {
    // Get script URI
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'comparison.js'),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
    <title>結果の比較</title>
    <style nonce="${nonce}">
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.initialData = ${JSON.stringify(comparisonData)};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
