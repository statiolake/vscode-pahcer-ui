export interface TestCase {
  seed: number;
  score: number;
  relativeScore: number;
  executionTime: number; // in seconds
}

export interface ResultData {
  id: string;
  time: string;
  cases: TestCase[];
}

export interface RankingPoolEntry {
  id: string;
  comment: string;
  cases: Array<{ seed: number; score: number }>;
}

export interface ComparisonConfig {
  featureString: string;
  xAxis: string;
  yAxis: string;
  chartType: 'line' | 'scatter';
  filter: string;
  bestRankingInclude: string;
  bestRankingExclude: string;
}

export interface ComparisonData {
  results: ResultData[];
  seeds: number[];
  inputData: Record<number, string>;
  stderrData: Record<string, Record<number, Record<string, number>>>; // resultId -> seed -> variables
  rankingPool: RankingPoolEntry[];
  /**
   * Optimization direction of the score ('max' = maximize, 'min' = minimize).
   * Used to determine #Best / #Unique in the stats table.
   */
  objective: 'max' | 'min';
  config: ComparisonConfig;
}

export interface ChartDataPoint {
  x: number;
  y: number;
  resultId: string;
  seed: number;
  variables?: Record<string, number>;
  // For aggregated points: list of all seeds and their Y values in the group
  group?: Array<{ seed: number; y: number }>;
}

export interface StatsRow {
  id: string;
  name: string;
  totalScore: number;
  mean: number;
  sd: number;
  bestCount: number;
  uniqueBestCount: number;
  failCount: number;
  filteredCount: number;
  totalCount: number;
  /** テストケースフィルター適用時のランク（rankingPool 内）。フィルター未指定時は undefined */
  rank?: number;
}
