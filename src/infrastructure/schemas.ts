import { z } from 'zod';

/**
 * pahcer が出力する result.json の .cases 配列内の各ケースのスキーマ
 */
export const ResultJsonCaseSchema = z.object({
  seed: z.number(),
  score: z.number(),
  relative_score: z.number(),
  execution_time: z.number(),
  error_message: z.string(),
});

export type ResultJsonCase = z.infer<typeof ResultJsonCaseSchema>;

/**
 * pahcer が出力する result.json のスキーマ
 */
export const ResultJsonSchema = z.object({
  start_time: z.string(),
  comment: z.string(),
  tag_name: z.string().nullable(),
  cases: z.array(ResultJsonCaseSchema).optional(),
});

export type ResultJson = z.infer<typeof ResultJsonSchema>;

/**
 * Execution のメタデータ（meta/execution.json）のスキーマ
 */
export const ExecutionMetadataSchema = z.object({
  commitHash: z.string().optional(),
});

export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

/**
 * TestCase のメタデータ（meta/testcase_{seed}.json）のスキーマ
 */
export const TestCaseMetadataSchema = z.object({
  firstInputLine: z.string().optional(),
  stderrVars: z.record(z.string(), z.number()).optional(),
});

export type TestCaseMetadata = z.infer<typeof TestCaseMetadataSchema>;

/**
 * UIConfig のスキーマ
 */
export const UIConfigSchema = z.object({
  features: z.string().optional(),
  xAxis: z.string().optional(),
  yAxis: z.string().optional(),
  graphType: z.string().optional(),
  skipFailures: z.boolean().optional(),
});

export type UIConfig = z.infer<typeof UIConfigSchema>;
