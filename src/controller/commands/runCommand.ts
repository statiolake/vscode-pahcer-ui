import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import type { ExecutionRepository } from '../../infrastructure/executionRepository';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { InOutRepository } from '../../infrastructure/inOutRepository';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	taskAdapter: TaskAdapter,
	inOutRepository: InOutRepository,
	executionRepository: ExecutionRepository,
	treeViewController: PahcerTreeViewController,
): () => Promise<void> {
	return async () => {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

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
			await inOutRepository.copyOutputFiles(
				latestExecution.id,
				latestExecution,
				commitHash || undefined,
			);
		}
		treeViewController.refresh();
	};
}
