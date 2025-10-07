/**
 * テストケースのドメインモデル
 */
export interface TestCase {
	seed: number;
	score: number;
	relativeScore: number;
	executionTime: number;
	errorMessage: string;
}
