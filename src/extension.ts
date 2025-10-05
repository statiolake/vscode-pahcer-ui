import * as vscode from "vscode";
import { PahcerResultsProvider } from "./pahcerResultsProvider";

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Create TreeView provider
  const pahcerResultsProvider = new PahcerResultsProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView("pahcerResults", {
    treeDataProvider: pahcerResultsProvider,
    showCollapseAll: true,
  });

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    "vscode-pahcer-ui.refresh",
    () => {
      pahcerResultsProvider.refresh();
    }
  );

  // Register run command
  const runCommand = vscode.commands.registerCommand(
    "vscode-pahcer-ui.run",
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("ワークスペースが開かれていません");
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: "Pahcer Run",
        cwd: workspaceFolder.uri.fsPath,
      });

      terminal.show();
      terminal.sendText("pahcer run");

      // Auto-refresh after terminal closes
      const disposable = vscode.window.onDidCloseTerminal((t) => {
        if (t === terminal) {
          setTimeout(() => pahcerResultsProvider.refresh(), 1000);
          disposable.dispose();
        }
      });
    }
  );

  context.subscriptions.push(treeView, refreshCommand, runCommand);
}

export function deactivate() {}
