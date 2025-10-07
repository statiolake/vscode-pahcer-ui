export interface TestCase {
	seed: number;
	score: number;
	relativeScore: number;
}

export interface ResultData {
	id: string;
	time: string;
	cases: TestCase[];
}

export interface ComparisonData {
	results: ResultData[];
	seeds: number[];
	inputData: Record<number, string>;
	config: {
		features?: string;
		xAxis?: string;
		yAxis?: string;
	};
}

export interface ChartDataPoint {
	x: number;
	y: number;
	resultId: string;
	seed: number;
	variables?: Record<string, number>;
}

export interface StatsRow {
	name: string;
	totalScore: number;
	mean: number;
	sd: number;
	bestCount: number;
	uniqueBestCount: number;
	failCount: number;
}
