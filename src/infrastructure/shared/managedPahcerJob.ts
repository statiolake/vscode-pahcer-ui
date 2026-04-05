import { randomUUID } from 'node:crypto';
import type {
  DisposableLike,
  PahcerJob,
  PahcerJobEvent,
  PahcerJobResult,
} from '../../domain/interfaces/pahcerJob';

export class ManagedPahcerJob implements PahcerJob {
  readonly id = randomUUID();

  private readonly listeners = new Set<(event: PahcerJobEvent) => void>();
  private completionPromise: Promise<PahcerJobResult>;
  private resolveCompletion!: (result: PahcerJobResult) => void;
  private rejectCompletion!: (error: unknown) => void;

  constructor() {
    this.completionPromise = new Promise<PahcerJobResult>((resolve, reject) => {
      this.resolveCompletion = resolve;
      this.rejectCompletion = reject;
    });
  }

  wait(): Promise<PahcerJobResult> {
    return this.completionPromise;
  }

  subscribe(listener: (event: PahcerJobEvent) => void): DisposableLike {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  emit(event: PahcerJobEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  complete(exitCode: number): void {
    this.emit({ type: 'completed', exitCode });
    this.resolveCompletion({ exitCode });
  }

  fail(message: string): void {
    this.emit({ type: 'failed', message });
    this.rejectCompletion(new Error(message));
  }
}
