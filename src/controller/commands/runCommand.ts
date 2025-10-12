import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import type { ConfigAdapter } from '../../infrastructure/configAdapter';
import type { DialogAdapter } from '../../infrastructure/dialogAdapter';
import type { ExecutionRepository } from '../../infrastructure/executionRepository';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { InOutRepository } from '../../infrastructure/inOutRepository';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';
import type { WorkspaceAdapter } from '../../infrastructure/workspaceAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	workspaceAdapter: WorkspaceAdapter,
	taskAdapter: TaskAdapter,
	inOutRepository: InOutRepository,
	executionRepository: ExecutionRepository,
	treeViewController: PahcerTreeViewController,
	configAdapter: ConfigAdapter,
	dialogAdapter: DialogAdapter,
): () => Promise<void> {
	return async () => {
		const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

		if (!workspaceRoot) {
			dialogAdapter.showErrorMessage('ワークスペースが開かれていません');
			return;
		}

		// Git統合チェック＆コミット
		let commitHash: string | null = null;
		try {
			commitHash = await checkAndCommitIfEnabled(workspaceRoot, configAdapter, dialogAdapter);
		} catch (error) {
			dialogAdapter.showErrorMessage(`gitの操作に失敗しました: ${error}`);
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
