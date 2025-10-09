import React, { useMemo, useState } from 'react';
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
	type ChartEvent,
	type ActiveElement,
	type TooltipItem,
} from 'chart.js';
import type { ComparisonData, ChartDataPoint } from '../types';
import { evaluateExpression } from '../../shared/utils/expression';
import { parseFeatures } from '../../shared/utils/features';
import { postMessage } from '../../shared/utils/vscode';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
	data: ComparisonData;
	featureString: string;
	xAxis: string;
	yAxis: string;
	chartType: 'line' | 'scatter';
	skipFailed: boolean;
	filter: string;
}

interface PopupState {
	x: number;
	y: number;
	point: ChartDataPoint;
}

export function ComparisonChart({
	data,
	featureString,
	xAxis,
	yAxis,
	chartType,
	skipFailed,
	filter,
}: Props) {
	const [popup, setPopup] = useState<PopupState | null>(null);

	const { chartData, xAxisLabel, yAxisLabel } = useMemo(
		() => prepareChartData(data, featureString, xAxis, yAxis, chartType, skipFailed, filter),
		[data, featureString, xAxis, yAxis, chartType, skipFailed, filter],
	);

	// Get VSCode theme colors
	const textColor =
		getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#cccccc';
	const gridColor =
		getComputedStyle(document.body).getPropertyValue('--vscode-panel-border') || '#3e3e3e';

	const handlePointClick = (event: ChartEvent, elements: ActiveElement[]) => {
		if (Array.isArray(elements) && elements.length > 0) {
			const element = elements[0] as { datasetIndex: number; index: number };
			const point = chartData.datasets[element.datasetIndex]?.data[element.index];
			if (point && event.native && event.native instanceof MouseEvent) {
				// If the point has a group (aggregated), show popup
				if (point.group && point.group.length > 1) {
					setPopup({
						x: event.native.clientX,
						y: event.native.clientY,
						point,
					});
				} else {
					// Single point or non-aggregated: navigate directly
					postMessage({
						command: 'showVisualizer',
						resultId: point.resultId,
						seed: point.seed,
					});
				}
			}
		}
	};

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		onClick: handlePointClick,
		plugins: {
			legend: {
				position: 'top' as const,
				labels: {
					color: textColor,
				},
			},
			tooltip: {
				backgroundColor: 'rgba(0, 0, 0, 0.8)',
				titleColor: '#ffffff',
				bodyColor: '#ffffff',
				borderColor: gridColor,
				borderWidth: 1,
				callbacks: {
					label: function (context: TooltipItem<'line' | 'scatter'>) {
						const point = context.raw as ChartDataPoint;
						const lines = [context.dataset.label + ': ' + point.y.toLocaleString()];

						if (point.group && point.group.length > 1) {
							lines.push(`(${point.group.length} 件を集約)`);
							lines.push('x: ' + point.x);
						} else {
							lines.push('seed: ' + point.seed);
							lines.push('x: ' + point.x);
							if (point.variables) {
								lines.push('vars: ' + JSON.stringify(point.variables));
							}
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
					color: textColor,
				},
				ticks: {
					color: textColor,
				},
				grid: {
					color: gridColor,
				},
			},
			y: {
				title: {
					display: true,
					text: yAxisLabel,
					color: textColor,
				},
				ticks: {
					color: textColor,
				},
				grid: {
					color: gridColor,
				},
			},
		},
	};

	const handleSeedClick = (resultId: string, seed: number) => {
		postMessage({
			command: 'showVisualizer',
			resultId,
			seed,
		});
		setPopup(null);
	};

	const handleClosePopup = () => {
		setPopup(null);
	};

	return (
		<div style={{ position: 'relative', height: '600px', marginTop: '20px' }}>
			{chartType === 'line' ? (
				<Line data={chartData} options={options} />
			) : (
				<Scatter data={chartData} options={options} />
			)}

			{popup && (
				<>
					{/* Backdrop to close popup */}
					<div
						style={{
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: 999,
						}}
						onClick={handleClosePopup}
					/>
					{/* Popup */}
					<div
						style={{
							position: 'fixed',
							left: popup.x + 10,
							top: popup.y + 10,
							backgroundColor: 'var(--vscode-editor-background)',
							border: '1px solid var(--vscode-panel-border)',
							borderRadius: '4px',
							padding: '10px',
							maxHeight: '300px',
							overflowY: 'auto',
							zIndex: 1000,
							boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
						}}
					>
						<div style={{ marginBottom: '8px', fontWeight: 'bold', color: textColor }}>
							集約された Seed (x={popup.point.x})
						</div>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
							{popup.point.group?.map((item) => (
								<a
									key={item.seed}
									href="#"
									onClick={(e) => {
										e.preventDefault();
										handleSeedClick(popup.point.resultId, item.seed);
									}}
									style={{
										color: 'var(--vscode-textLink-foreground)',
										textDecoration: 'none',
										padding: '4px 8px',
										borderRadius: '2px',
										cursor: 'pointer',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
										e.currentTarget.style.textDecoration = 'underline';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent';
										e.currentTarget.style.textDecoration = 'none';
									}}
								>
									Seed {item.seed}: {item.y.toLocaleString()}
								</a>
							))}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function prepareChartData(
	data: ComparisonData,
	featuresStr: string,
	xAxis: string,
	yAxis: string,
	chartType: 'line' | 'scatter',
	skipFailed: boolean,
	filter: string,
) {
	const features = parseFeatures(featuresStr);
	const { results, seeds, inputData, stderrData } = data;

	const datasets = results.map((result, index) => {
		const color = getColorForResultId(result.id);
		const filteredSeeds = seeds.filter((seed) => {
			if (!skipFailed) return true;
			const testCase = result.cases.find((c) => c.seed === seed);
			return testCase && testCase.score > 0;
		});

		// Step 1: Calculate X value for each seed (scalar) and apply filter
		type SeedData = {
			seed: number;
			xValue: number;
			testCase: NonNullable<ReturnType<typeof result.cases.find>>;
			inputLine: string;
		};

		const seedDataList: SeedData[] = filteredSeeds
			.map((seed) => {
				const testCase = result.cases.find((c) => c.seed === seed);
				if (!testCase) return null;

				const inputLine = inputData[seed] || '';
				const variables: Record<string, number[]> = {};
				variables.seed = [seed];
				variables.absScore = [testCase.score];
				variables.relScore = [testCase.relativeScore];
				variables.msec = [testCase.executionTime * 1000]; // Convert seconds to milliseconds

				// Parse features
				const featureValues = parseFeatures(inputLine);
				for (let i = 0; i < features.length && i < featureValues.length; i++) {
					variables[features[i]] = [Number(featureValues[i]) || 0];
				}

				// Get stderr variables (with $ prefix)
				const stderrVars = stderrData[result.id]?.[seed] || {};
				for (const [varName, value] of Object.entries(stderrVars)) {
					variables[`$${varName}`] = [value];
				}

				// Apply filter if specified
				if (filter.trim() !== '') {
					try {
						const filterResult = evaluateExpression(filter, variables);
						// Filter returns 1 for true, 0 for false
						if (filterResult[0] === 0) {
							return null; // Skip this seed
						}
					} catch (e) {
						console.warn(`Filter evaluation failed for seed ${seed}:`, e);
						return null;
					}
				}

				try {
					const xResult = evaluateExpression(xAxis, variables);
					const xValue = xResult[0]; // X must be scalar
					return { seed, xValue, testCase, inputLine };
				} catch {
					return null;
				}
			})
			.filter((d): d is NonNullable<typeof d> => d !== null);

		// Step 2: Group by X value
		const groupedByX = new Map<number, SeedData[]>();
		for (const seedData of seedDataList) {
			const key = seedData.xValue;
			if (!groupedByX.has(key)) {
				groupedByX.set(key, []);
			}
			groupedByX.get(key)!.push(seedData);
		}

		// Step 3: For each group, evaluate Y axis with arrays
		const chartData: ChartDataPoint[] = [];
		for (const [xValue, group] of groupedByX.entries()) {
			// Build arrays for Y evaluation
			const variables: Record<string, number[]> = {};
			variables.seed = group.map((d) => d.seed);
			variables.absScore = group.map((d) => d.testCase.score);
			variables.relScore = group.map((d) => d.testCase.relativeScore);
			variables.msec = group.map((d) => d.testCase.executionTime * 1000);

			// Parse features for each group member
			for (const featureName of features) {
				variables[featureName] = group.map((d) => {
					const featureValues = parseFeatures(d.inputLine);
					const featureIndex = features.indexOf(featureName);
					return Number(featureValues[featureIndex]) || 0;
				});
			}

			// Collect all stderr variables from all group members
			const allStderrVarNames = new Set<string>();
			for (const d of group) {
				const stderrVars = stderrData[result.id]?.[d.seed] || {};
				for (const varName of Object.keys(stderrVars)) {
					allStderrVarNames.add(varName);
				}
			}

			// Build arrays for stderr variables
			for (const varName of allStderrVarNames) {
				variables[`$${varName}`] = group.map((d) => {
					const stderrVars = stderrData[result.id]?.[d.seed] || {};
					return stderrVars[varName] || 0;
				});
			}

			try {
				const yResult = evaluateExpression(yAxis, variables);

				// If yResult length matches group length, create one point per seed (not aggregated)
				if (yResult.length === group.length) {
					for (let i = 0; i < group.length; i++) {
						chartData.push({
							x: xValue,
							y: yResult[i],
							resultId: result.id,
							seed: group[i].seed,
							variables: {
								seed: group[i].seed,
								absScore: group[i].testCase.score,
								relScore: group[i].testCase.relativeScore,
							},
							// No group field for non-aggregated points
						});
					}
				} else if (yResult.length === 1) {
					// Aggregated: create one point with group information
					chartData.push({
						x: xValue,
						y: yResult[0],
						resultId: result.id,
						seed: group[0].seed, // Representative seed (not used for single-seed navigation)
						variables: {}, // No specific variables for aggregated point
						group: group.map((g) => {
							// Re-evaluate Y for each individual seed to show in popup
							const singleVars: Record<string, number[]> = {};
							singleVars.seed = [g.seed];
							singleVars.absScore = [g.testCase.score];
							singleVars.relScore = [g.testCase.relativeScore];
							singleVars.msec = [g.testCase.executionTime * 1000];

							for (const featureName of features) {
								const featureValues = parseFeatures(g.inputLine);
								const featureIndex = features.indexOf(featureName);
								singleVars[featureName] = [Number(featureValues[featureIndex]) || 0];
							}

							const stderrVars = stderrData[result.id]?.[g.seed] || {};
							for (const [varName, value] of Object.entries(stderrVars)) {
								singleVars[`$${varName}`] = [value];
							}

							try {
								const singleY = evaluateExpression(yAxis, singleVars);
								return { seed: g.seed, y: singleY[0] };
							} catch {
								return { seed: g.seed, y: g.testCase.score };
							}
						}),
					});
				} else {
					console.warn(
						`Y result length (${yResult.length}) doesn't match group length (${group.length}) or 1`,
					);
				}
			} catch (e) {
				console.warn(`Failed to evaluate Y for X=${xValue}:`, e);
			}
		}

		// Sort by x value
		chartData.sort((a, b) => a.x - b.x);

		return {
			label: result.time,
			data: chartData,
			borderColor: color,
			backgroundColor: color,
			showLine: chartType === 'line',
			pointRadius: 3,
		};
	});

	return {
		chartData: { datasets },
		xAxisLabel: xAxis,
		yAxisLabel: yAxis,
	};
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
