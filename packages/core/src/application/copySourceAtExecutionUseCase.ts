import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IGitAdapter } from '../domain/interfaces/IGitAdapter';

export type SourceCopyPreparation =
  | { status: 'notFound' }
  | { status: 'missingCommitHash' }
  | { status: 'noFiles' }
  | { status: 'ready'; files: string[] };

export class CopySourceAtExecutionUseCase {
  constructor(
    private readonly executionRepository: IExecutionRepository,
    private readonly gitAdapter: IGitAdapter,
  ) {}

  async prepare(executionId: string): Promise<SourceCopyPreparation> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return { status: 'notFound' };
    }

    if (!execution.commitHash) {
      return { status: 'missingCommitHash' };
    }

    const files = await this.gitAdapter.getSourceFilesAtCommit(execution.commitHash);
    if (files.length === 0) {
      return { status: 'noFiles' };
    }

    return { status: 'ready', files };
  }

  async loadContent(executionId: string, file: string): Promise<string | undefined> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution?.commitHash) {
      return undefined;
    }

    return this.gitAdapter.getFileContentAtCommit(execution.commitHash, file);
  }
}
