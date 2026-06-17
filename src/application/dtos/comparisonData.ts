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

export interface ComparisonData {
  results: ComparisonResultData[];
  seeds: number[];
  inputData: Record<number, string>;
  stderrData: Record<string, Record<number, Record<string, number>>>;
  config: ComparisonConfig;
}
