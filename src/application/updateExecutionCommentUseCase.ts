import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';

export class UpdateExecutionCommentUseCase {
  constructor(private readonly executionRepository: IExecutionRepository) {}

  async update(executionId: string, comment: string): Promise<boolean> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return false;
    }

    execution.comment = comment;
    await this.executionRepository.upsert(execution);
    return true;
  }
}
