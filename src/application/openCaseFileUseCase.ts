import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';

export type CaseFileKind = 'input' | 'output' | 'error';

export interface OpenCaseFileRequest {
  kind: CaseFileKind;
  executionId?: string;
  seed: number;
}

export class OpenCaseFileUseCase {
  constructor(private readonly inOutFilesAdapter: IInOutFilesAdapter) {}

  resolvePath(request: OpenCaseFileRequest): string | undefined {
    if (request.kind === 'input') {
      return this.inOutFilesAdapter.getNonArchivedPath('in', request.seed);
    }

    if (!request.executionId) {
      return undefined;
    }

    return this.inOutFilesAdapter.getArchivedPath(request.kind === 'output' ? 'out' : 'err', {
      executionId: request.executionId,
      seed: request.seed,
    });
  }
}
