import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import { PahcerStatus } from '../domain/models/pahcerStatus';
import type { PahcerStatusView } from './dtos/pahcerUIState';

export class CheckPahcerStatusUseCase {
  constructor(private readonly pahcerAdapter: IPahcerAdapter) {}

  async check(): Promise<PahcerStatusView> {
    return this.toViewStatus(await this.pahcerAdapter.checkStatus());
  }

  async isReady(): Promise<boolean> {
    return (await this.check()) === 'ready';
  }

  private toViewStatus(status: PahcerStatus): PahcerStatusView {
    switch (status) {
      case PahcerStatus.NotInstalled:
        return 'notInstalled';
      case PahcerStatus.NotInitialized:
        return 'notInitialized';
      case PahcerStatus.Ready:
        return 'ready';
      default:
        return 'unknown';
    }
  }
}
