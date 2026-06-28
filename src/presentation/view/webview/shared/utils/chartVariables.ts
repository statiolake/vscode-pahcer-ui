import { parseFeatures } from './features';

/** Built-in variables available in comparison chart expressions */
export const BUILTIN_CHART_VARIABLES = ['seed', 'absScore', 'relScore', 'sec', 'msec'] as const;

export interface ChartCaseData {
  seed: number;
  score: number;
  relativeScore: number;
  /** Execution time in seconds */
  executionTime: number;
}

export interface BuildChartVariablesParams {
  caseData: ChartCaseData;
  features: string[];
  inputLine: string;
  stderrVars: Record<string, number>;
}

/**
 * Build expression variables for a single test case.
 * Execution time is exposed as `sec` (seconds) and `msec` (milliseconds).
 */
export function buildChartVariables({
  caseData,
  features,
  inputLine,
  stderrVars,
}: BuildChartVariablesParams): Record<string, number[]> {
  const variables: Record<string, number[]> = {};
  variables.seed = [caseData.seed];
  variables.absScore = [caseData.score];
  variables.relScore = [caseData.relativeScore];
  variables.sec = [caseData.executionTime];
  variables.msec = [caseData.executionTime * 1000];

  const featureValues = parseFeatures(inputLine);
  for (let i = 0; i < features.length && i < featureValues.length; i++) {
    variables[features[i]] = [Number(featureValues[i]) || 0];
  }

  for (const [varName, value] of Object.entries(stderrVars)) {
    variables[`$${varName}`] = [value];
  }

  return variables;
}

export interface BuildGroupChartVariablesParams {
  group: Array<{
    seed: number;
    caseData: ChartCaseData;
    inputLine: string;
  }>;
  features: string[];
  getStderrVars: (seed: number) => Record<string, number>;
}

/**
 * Build expression variables for a group of test cases (array semantics).
 */
export function buildGroupChartVariables({
  group,
  features,
  getStderrVars,
}: BuildGroupChartVariablesParams): Record<string, number[]> {
  const variables: Record<string, number[]> = {};
  variables.seed = group.map((d) => d.seed);
  variables.absScore = group.map((d) => d.caseData.score);
  variables.relScore = group.map((d) => d.caseData.relativeScore);
  variables.sec = group.map((d) => d.caseData.executionTime);
  variables.msec = group.map((d) => d.caseData.executionTime * 1000);

  for (const featureName of features) {
    const featureIndex = features.indexOf(featureName);
    variables[featureName] = group.map((d) => {
      const featureValues = parseFeatures(d.inputLine);
      return Number(featureValues[featureIndex]) || 0;
    });
  }

  const allStderrVarNames = new Set<string>();
  for (const d of group) {
    for (const varName of Object.keys(getStderrVars(d.seed))) {
      allStderrVarNames.add(varName);
    }
  }

  for (const varName of allStderrVarNames) {
    variables[`$${varName}`] = group.map((d) => getStderrVars(d.seed)[varName] || 0);
  }

  return variables;
}

/**
 * Convert single-element variable arrays to scalars (e.g. for tooltips).
 */
export function chartVariablesToScalars(
  variables: Record<string, number[]>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, values] of Object.entries(variables)) {
    if (values.length === 1) {
      result[key] = values[0];
    }
  }
  return result;
}
