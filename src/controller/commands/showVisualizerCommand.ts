import type { VisualizerViewController } from '../visualizerViewController';

/**
 * ビジュアライザ表示コマンドハンドラ
 */
export function showVisualizerCommand(
	visualizerViewController: VisualizerViewController,
): (seed: number, executionId?: string) => Promise<void> {
	return async (seed: number, executionId?: string) => {
		await visualizerViewController.showVisualizerForCase(seed, executionId);
	};
}
