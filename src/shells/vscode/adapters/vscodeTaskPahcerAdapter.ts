import * as vscode from 'vscode';
import type { IPahcerAdapter } from '../../../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../../../domain/interfaces/IPahcerConfigRepository';
import type { InitPahcerCommand, RunPahcerCommand } from '../../../domain/interfaces/pahcerJob';
import type { PahcerStatus } from '../../../domain/models/pahcerStatus';
import { FileOperationError } from '../../../infrastructure/exceptions';
import { ManagedPahcerJob } from '../../../infrastructure/shared/managedPahcerJob';

export class VSCodeTaskPahcerAdapter implements IPahcerAdapter {
  constructor(
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
    private readonly workspaceRoot: string,
  ) {}

  async checkStatus(): Promise<PahcerStatus> {
    const isInstalled = await this.executeShellProbe('pahcer --version');
    if (!isInstalled) {
      return 'notInstalled';
    }

    try {
      const config = await this.pahcerConfigRepository.findById('normal');
      return config ? 'ready' : 'notInitialized';
    } catch {
      return 'notInitialized';
    }
  }

  async startInit(command: InitPahcerCommand) {
    let shellCommand =
      'pahcer init --problem "' +
      command.problemName +
      '" --objective ' +
      command.objective +
      ' --lang ' +
      command.language;
    if (command.isInteractive) {
      shellCommand += ' --interactive';
    }
    return this.executeTask('Pahcer Init', 'init', shellCommand);
  }

  async startRun(command: RunPahcerCommand) {
    let shellCommand = 'pahcer run';
    if (command.configFile) {
      shellCommand += ` --setting-file "${command.configFile.path}"`;
    }
    if (command.options?.freezeBestScores) {
      shellCommand += ' --freeze-best-scores';
    }
    return this.executeTask('Pahcer Run', 'run', shellCommand);
  }

  private async executeShellProbe(command: string): Promise<boolean> {
    try {
      const exitCode = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Pahcer を確認中...',
          cancellable: false,
        },
        async () => {
          const execution = new vscode.ShellExecution(command, { cwd: this.workspaceRoot });
          const task = new vscode.Task(
            { type: 'pahcer', task: 'probe' },
            vscode.TaskScope.Workspace,
            'Pahcer Probe',
            'pahcer',
            execution,
          );
          task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Never,
            focus: false,
            panel: vscode.TaskPanelKind.Dedicated,
            showReuseMessage: false,
            clear: true,
          };
          const taskExecution = await vscode.tasks.executeTask(task);
          return await new Promise<number>((resolve) => {
            const disposable = vscode.tasks.onDidEndTaskProcess((event) => {
              if (event.execution === taskExecution) {
                disposable.dispose();
                resolve(event.exitCode ?? 1);
              }
            });
          });
        },
      );
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  private async executeTask(name: string, commandType: 'init' | 'run', shellCommand: string) {
    if (!this.workspaceRoot) {
      throw new FileOperationError('executeTask', '<workspace-root>', 'workspaceRoot is required');
    }

    const taskExecution = new vscode.ShellExecution(shellCommand, {
      cwd: this.workspaceRoot,
    });

    const task = new vscode.Task(
      { type: 'pahcer', task: name },
      vscode.TaskScope.Workspace,
      name,
      'pahcer',
      taskExecution,
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      focus: false,
      panel: vscode.TaskPanelKind.Shared,
      showReuseMessage: false,
      clear: false,
    };

    const managedJob = new ManagedPahcerJob();
    managedJob.emit({ type: 'started', command: commandType });

    const execution = await vscode.tasks.executeTask(task);
    const processDisposable = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution === execution) {
        processDisposable.dispose();
        endDisposable.dispose();
        managedJob.complete(event.exitCode ?? 0);
      }
    });
    const endDisposable = vscode.tasks.onDidEndTask((event) => {
      if (event.execution === execution) {
        processDisposable.dispose();
        endDisposable.dispose();
      }
    });

    return managedJob;
  }
}
