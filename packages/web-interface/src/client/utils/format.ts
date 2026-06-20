import type {
  TreeExecutionStats,
  TreeSeedExecution,
} from '@pahcer/core/application/dtos/pahcerTreeData';

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatSeed(seed: number): string {
  return String(seed).padStart(4, '0');
}

export function formatExecutionTime(seconds: number): string {
  return `${(seconds * 1000).toFixed(2)}ms`;
}

export function executionTreeLabel(stats: TreeExecutionStats): string {
  return `${stats.execution.shortTitle} - Avg: ${stats.averageScore.toFixed(1)} (${stats.averageRelativeScore.toFixed(2)}%)`;
}

export function seedExecutionLabel(execution: TreeSeedExecution): string {
  return `${execution.execution.shortTitle}: ${execution.testCase.score.toLocaleString()} (${execution.relativeScore.toFixed(3)}%)`;
}

export function executionDescription(execution: TreeExecutionStats['execution']): string {
  const tagName = execution.tagName?.replace(/^pahcer\//, '');
  return [execution.comment, tagName].filter(Boolean).join(' · ');
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
