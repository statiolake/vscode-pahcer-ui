import React, { useMemo } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
} from 'chart.js';
import type { ComparisonData, ChartDataPoint } from '../types';
import { evaluateExpression } from '../../shared/utils/expression';
import { postMessage } from '../../shared/utils/vscode';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
	data: ComparisonData;
	features: string;
	xAxis: string;
	yAxis: 'absolute' | 'relative';
	chartType: 'line' | 'scatter';
	skipFailed: boolean;
}

export function ComparisonChart({ data, features, xAxis, yAxis, chartType, skipFailed }: Props) {
	const { chartData, xAxisLabel, yAxisLabel } = useMemo(
		() => prepareChartData(data, features, xAxis, yAxis, skipFailed),
		[data, features, xAxis, yAxis, skipFailed],
	);

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		onClick: (_: unknown, elements: unknown[]) => {
			if (Array.isArray(elements) && elements.length > 0) {
				const element = elements[0] as { datasetIndex: number; index: number };
				const point = chartData.datasets[element.datasetIndex]?.data[element.index];
				if (point) {
					postMessage({
						command: 'showVisualizer',
						resultId: point.resultId,
						seed: point.seed,
					});
				}
			}
		},
		plugins: {
			legend: {
				position: 'top' as const,
			},
			tooltip: {
				callbacks: {
					label: function (context: any) {
						const point = context.raw as ChartDataPoint;
						const lines = [
							context.dataset.label + ': ' + point.y.toLocaleString(),
							'seed: ' + point.seed,
							'x: ' + point.x,
						];
						if (point.variables) {
							lines.push('vars: ' + JSON.stringify(point.variables));
						}
						return lines;
					},
				},
			},
		},
		scales: {
			x: {
				type: 'linear' as const,
				title: {
					display: true,
					text: xAxisLabel,
				},
			},
			y: {
				title: {
					display: true,
					text: yAxisLabel,
				},
			},
		},
	};

	return (
		<div style={{ position: 'relative', height: '600px', marginTop: '20px' }}>
			{chartType === 'line' ? (
				<Line data={chartData} options={options} />
			) : (
				<Scatter data={chartData} options={options} />
			)}
		</div>
	);
}

function prepareChartData(
	data: ComparisonData,
	featuresStr: string,
	xAxis: string,
	yAxis: 'absolute' | 'relative',
	skipFailed: boolean,
) {
	const features = featuresStr
		.trim()
		.split(/\s+/)
		.filter((f) => f.length > 0);
	const { results, seeds, inputData } = data;

	const datasets = results.map((result, index) => {
		const color = getColorForResultId(result.id);
		const filteredSeeds = seeds.filter((seed) => {
			if (!skipFailed) return true;
			const testCase = result.cases.find((c) => c.seed === seed);
			return testCase && testCase.score > 0;
		});

		const chartData = filteredSeeds
			.map((seed) => {
				const testCase = result.cases.find((c) => c.seed === seed);
				if (!testCase) return null;

				// Parse input line to get variables
				const variables = parseInputLine(seed, inputData[seed], features);

				// Evaluate X axis expression
				const xValue = evaluateExpression(xAxis, variables);

				return {
					x: xValue,
					y: yAxis === 'absolute' ? testCase.score : testCase.relativeScore,
					resultId: result.id,
					seed,
					variables,
				};
			})
			.filter((d): d is NonNullable<typeof d> => d !== null);

		// Sort by x value
		chartData.sort((a, b) => (a?.x ?? 0) - (b?.x ?? 0));

		return {
			label: result.time,
			data: chartData,
			borderColor: color,
			backgroundColor: color,
			showLine: true,
			pointRadius: 3,
		};
	});

	return {
		chartData: { datasets },
		xAxisLabel: xAxis,
		yAxisLabel: yAxis === 'absolute' ? 'スコア' : '相対スコア (%)',
	};
}

function parseInputLine(seed: number, line: string | undefined, features: string[]): Record<string, number> {
	const parsed: Record<string, number> = { seed };

	if (!line) return parsed;

	const values = line.split(/\s+/).filter((v) => v.length > 0);
	for (let i = 0; i < Math.min(features.length, values.length); i++) {
		const num = parseFloat(values[i]);
		parsed[features[i]] = isNaN(num) ? 0 : num;
	}

	return parsed;
}

function getColorForResultId(resultId: string): string {
	let hash = 0;
	for (let i = 0; i < resultId.length; i++) {
		hash = resultId.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = Math.abs(hash % 360);
	const saturation = 70 + (Math.abs(hash >> 8) % 20);
	const lightness = 50 + (Math.abs(hash >> 16) % 20);

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
