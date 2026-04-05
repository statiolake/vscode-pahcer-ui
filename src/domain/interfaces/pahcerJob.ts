export interface DisposableLike {
  dispose(): void;
}

export interface PahcerJobResult {
  exitCode: number;
}

export type PahcerJobEvent =
  | { type: 'started'; command: 'init' | 'run' }
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
  | { type: 'completed'; exitCode: number }
  | { type: 'failed'; message: string };

export interface PahcerJob {
  id: string;
  wait(): Promise<PahcerJobResult>;
  subscribe(listener: (event: PahcerJobEvent) => void): DisposableLike;
}

export interface InitPahcerCommand {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
}

export interface RunPahcerCommand {
  options?: import('../models/pahcerStatus').PahcerRunOptions;
  configFile?: import('../models/configFile').PahcerConfig;
}
