import type { TreeExecutionStats } from '@pahcer/core/application/dtos/pahcerTreeData';
import type {
  ExecutionSortOrder,
  GroupingMode,
  PahcerStatusView,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';

export type TreeData = {
  executions: TreeExecutionStats['execution'][];
  testCases: Array<{
    executionId: string;
    seed: number;
    score: number;
    executionTime: number;
  }>;
  objective: 'max' | 'min';
  bestScores: Record<string, number>;
  executionStatsList: TreeExecutionStats[];
};

export type WebPreferences = {
  gitIntegration: boolean | null;
  groupingMode: GroupingMode;
  executionSortOrder: ExecutionSortOrder;
  seedSortOrder: SeedSortOrder;
  visualizerZoomLevel: number;
};

export type StatusResponse = {
  status: PahcerStatusView;
  defaultProjectName: string;
  preferences: WebPreferences;
  workspaceRoot: string;
};

export type Panel = 'comparison' | 'case' | 'diff' | 'source' | 'visualizer' | 'initialize';

export type CaseFileKind = 'input' | 'output' | 'error';

export type FileView = {
  title: string;
  path?: string;
  content: string;
  kind?: CaseFileKind;
  executionId?: string;
  seed?: number;
};

export type DiffView = {
  status: string;
  executionIds?: string[];
  files?: Array<{ file: string; patch: string }>;
};

type SourcePreparationMeta = {
  executionId?: string;
};

export type SourcePreparation =
  | ({ status: 'notFound' } & SourcePreparationMeta)
  | ({ status: 'missingCommitHash' } & SourcePreparationMeta)
  | ({ status: 'noFiles' } & SourcePreparationMeta)
  | ({ status: 'ready'; files: string[] } & SourcePreparationMeta);

export type RunOptions = {
  startSeed?: number;
  endSeed?: number;
  freezeBestScores: boolean;
  enableGitIntegration?: boolean;
};

export type InitializeRequest = {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
  testerUrl: string;
  useDetectedInteractive: boolean;
};

export type SelectedCase = {
  executionId: string;
  seed: number;
};
