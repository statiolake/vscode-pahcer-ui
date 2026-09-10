import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { DiffFile, IGitAdapter } from '../domain/interfaces/IGitAdapter';
import type { Execution } from '../domain/models/execution';

export type ShowExecutionDiffResult =
  | { status: 'shown' }
  | { status: 'invalidSelection' }
  | { status: 'missingCommitHash' };

export type ResolvedExecutionDiff =
  | {
      status: 'shown';
      older: Execution & { commitHash: string };
      newer: Execution & { commitHash: string };
    }
  | { status: 'invalidSelection' }
  | { status: 'missingCommitHash' };

export type LoadExecutionDiffFilesResult =
  | {
      status: 'shown';
      older: Execution & { commitHash: string };
      newer: Execution & { commitHash: string };
      files: DiffFile[];
    }
  | { status: 'invalidSelection' }
  | { status: 'missingCommitHash' };

export class ShowExecutionDiffUseCase {
  constructor(
    private readonly executionRepository: IExecutionRepository,
    private readonly gitAdapter: IGitAdapter,
  ) {}

  async showDiff(executionIds: string[]): Promise<ShowExecutionDiffResult> {
    const resolved = await this.resolveDiff(executionIds);
    if (resolved.status !== 'shown') {
      return resolved;
    }

    const { older, newer } = resolved;

    await this.gitAdapter.showDiff(
      older.commitHash,
      newer.commitHash,
      older.getTitleWithHash(),
      newer.getTitleWithHash(),
    );

    return { status: 'shown' };
  }

  async resolveDiff(executionIds: string[]): Promise<ResolvedExecutionDiff> {
    const executions = await this.findExecutions(executionIds);

    if (executions.length !== 2) {
      return { status: 'invalidSelection' };
    }

    const [older, newer] = [...executions].sort(
      (left, right) => left.startTime.valueOf() - right.startTime.valueOf(),
    );
    if (!older || !newer) {
      return { status: 'invalidSelection' };
    }

    if (!hasCommitHash(older) || !hasCommitHash(newer)) {
      return { status: 'missingCommitHash' };
    }

    return { status: 'shown', older, newer };
  }

  /**
   * Load the diff between two executions as patches, for callers that render
   * it themselves (CLI, Web UI) instead of relying on the editor.
   */
  async loadDiffFiles(executionIds: string[]): Promise<LoadExecutionDiffFilesResult> {
    const resolved = await this.resolveDiff(executionIds);
    if (resolved.status !== 'shown') {
      return resolved;
    }

    return {
      status: 'shown',
      older: resolved.older,
      newer: resolved.newer,
      files: await this.gitAdapter.getDiffFiles(
        resolved.older.commitHash,
        resolved.newer.commitHash,
      ),
    };
  }

  async canShowDiff(executionIds: string[]): Promise<boolean> {
    return (await this.resolveDiff(executionIds)).status === 'shown';
  }

  private async findExecutions(executionIds: string[]): Promise<Execution[]> {
    return (
      await Promise.all(
        executionIds.map((executionId) => this.executionRepository.findById(executionId)),
      )
    ).filter((execution): execution is Execution => execution !== undefined);
  }
}

function hasCommitHash(execution: Execution): execution is Execution & { commitHash: string } {
  return typeof execution.commitHash === 'string' && execution.commitHash.length > 0;
}
