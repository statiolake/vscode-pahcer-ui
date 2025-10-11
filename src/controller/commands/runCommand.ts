import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import type { ExecutionRepository } from '../../infrastructure/executionRepository';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { OutputFileRepository } from '../../infrastructure/outputFileRepository';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';
import type { WorkspaceAdapter } from '../../infrastructure/workspaceAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	workspaceAdapter: WorkspaceAdapter,
	taskAdapter: TaskAdapter,
	outputFileRepository: OutputFileRepository,
	executionRepository: ExecutionRepository,
	treeViewController: PahcerTreeViewController,
): () => Promise<void> {
	return async () => {
		const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

		if (!workspaceRoot) {
			vscode.window.showErrorMessage('ワークスペースが開かれていません');
			return;
		}

		// Git統合チェック＆コミット
		let commitHash: string | null = null;
		try {
			commitHash = await checkAndCommitIfEnabled(workspaceRoot);
		} catch (error) {
			vscode.window.showErrorMessage(`gitの操作に失敗しました: ${error}`);
			return;
		}

		await taskAdapter.runPahcer(workspaceRoot);

		// Task completed - copy output files and refresh
		const latestExecution = await executionRepository.getLatestExecution();
		if (latestExecution) {
			await outputFileRepository.copyOutputFiles(
				latestExecution.id,
				latestExecution,
				commitHash || undefined,
			);
		}
		treeViewController.refresh();
	};
}
