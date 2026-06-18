export type PahcerStatusView = 'notInstalled' | 'notInitialized' | 'ready' | 'unknown';

export type GroupingMode = 'byExecution' | 'bySeed';

export type ExecutionSortOrder =
  | 'seedAsc'
  | 'seedDesc'
  | 'relativeScoreAsc'
  | 'relativeScoreDesc'
  | 'absoluteScoreAsc'
  | 'absoluteScoreDesc';

export type SeedSortOrder =
  | 'executionAsc'
  | 'executionDesc'
  | 'absoluteScoreAsc'
  | 'absoluteScoreDesc';
