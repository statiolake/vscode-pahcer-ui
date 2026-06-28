import type { ComparisonConfig } from './comparisonConfig';

export interface ComparisonTestCaseData {
  seed: number;
  score: number;
  relativeScore: number;
  executionTime: number;
}

export interface ComparisonResultData {
  id: string;
  time: string;
  cases: ComparisonTestCaseData[];
}

export interface ComparisonRankingPoolEntry {
  id: string;
  comment: string;
  cases: { seed: number; score: number }[];
}

export interface ComparisonData {
  results: ComparisonResultData[];
  seeds: number[];
  inputData: Record<number, string>;
  stderrData: Record<string, Record<number, Record<string, number>>>;
  config: ComparisonConfig;
  /**
   * All executions used for #Best / #Unique ranking.
   */
  rankingPool: ComparisonRankingPoolEntry[];
  /**
   * Optimization direction of the score ('max' = maximize, 'min' = minimize).
   * Used to determine #Best / #Unique in the stats table.
   */
  objective: 'max' | 'min';
}

export interface ComparisonViewOptions {
  featureString: string;
  xAxis: string;
  yAxis: string;
  chartType: 'line' | 'scatter';
  skipFailed: boolean;
  filter: string;
  bestRankingInclude: string;
  bestRankingExclude: string;
}

export type ComparisonViewReadModelOptions = Omit<ComparisonViewOptions, 'chartType'>;

export interface ComparisonChartPoint {
  x: number;
  y: number;
  resultId: string;
  seed: number;
  variables?: Record<string, number>;
  group?: Array<{ seed: number; y: number }>;
}

export interface ComparisonChartDataset {
  label: string;
  resultId: string;
  data: ComparisonChartPoint[];
}

export interface ComparisonChartReadModel {
  datasets: ComparisonChartDataset[];
  xAxisLabel: string;
  yAxisLabel: string;
}

export interface ComparisonStatsRow {
  name: string;
  totalScore: number;
  mean: number;
  sd: number;
  bestCount: number;
  uniqueBestCount: number;
  failCount: number;
  filteredCount: number;
  totalCount: number;
}

export interface ComparisonExpressionValidation {
  xAxis: boolean;
  yAxis: boolean;
  filter: boolean;
}

export interface ComparisonViewReadModel {
  chart: ComparisonChartReadModel;
  stats: ComparisonStatsRow[];
  validation: ComparisonExpressionValidation;
}
