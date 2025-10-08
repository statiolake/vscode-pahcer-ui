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

export interface ComparisonConfig {
	featureString: string;
	xAxis: string;
	yAxis: string;
	chartType: 'line' | 'scatter';
	filter: string;
}

export interface ComparisonData {
	results: ResultData[];
	seeds: number[];
	inputData: Record<number, string>;
	stderrData: Record<string, Record<number, string>>; // resultId -> seed -> stderr
	config: ComparisonConfig;
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
	filteredCount: number;
	totalCount: number;
}
