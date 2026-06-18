import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IGitAdapter } from '../domain/interfaces/IGitAdapter';
import type { Execution } from '../domain/models/execution';

export type ShowExecutionDiffResult =
  | { status: 'shown' }
  | { status: 'invalidSelection' }
  | { status: 'missingCommitHash' };

export class ShowExecutionDiffUseCase {
  constructor(
    private readonly executionRepository: IExecutionRepository,
    private readonly gitAdapter: IGitAdapter,
  ) {}

  async showDiff(executionIds: string[]): Promise<ShowExecutionDiffResult> {
    const executions = await this.findExecutionsWithCommitHash(executionIds);

    if (executions.length !== 2) {
      return { status: 'invalidSelection' };
    }

    const sorted = executions.sort((a, b) => a.startTime.valueOf() - b.startTime.valueOf());
    const older = sorted[0];
    const newer = sorted[1];

    if (!older || !newer) {
      return { status: 'invalidSelection' };
    }

    if (!older.commitHash || !newer.commitHash) {
      return { status: 'missingCommitHash' };
    }

    await this.gitAdapter.showDiff(
      older.commitHash,
      newer.commitHash,
      older.getTitleWithHash(),
      newer.getTitleWithHash(),
    );

    return { status: 'shown' };
  }

  async canShowDiff(executionIds: string[]): Promise<boolean> {
    const executions = await this.findExecutionsWithCommitHash(executionIds);
    return executions.length === 2;
  }

  private async findExecutionsWithCommitHash(executionIds: string[]): Promise<Execution[]> {
    return (
      await Promise.all(
        executionIds.map((executionId) => this.executionRepository.findById(executionId)),
      )
    ).filter((execution): execution is Execution => {
      return execution !== undefined && execution.commitHash !== undefined;
    });
  }
}
