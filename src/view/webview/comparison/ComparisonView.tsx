import React, { useState, useEffect } from 'react';
import type { ComparisonData } from './types';
import { StatsTable } from './components/StatsTable';
import { ComparisonChart } from './components/ComparisonChart';
import { ControlPanel } from './components/ControlPanel';
import { postMessage } from '../shared/utils/vscode';

interface Props {
	initialData: ComparisonData;
}

export function ComparisonView({ initialData }: Props) {
	const [featureString, setFeatureString] = useState(initialData.config.featureString);
	const [xAxis, setXAxis] = useState(initialData.config.xAxis);
	const [yAxis, setYAxis] = useState(initialData.config.yAxis);
	const [chartType, setChartType] = useState<'line' | 'scatter'>(initialData.config.chartType);
	const [filter, setFilter] = useState(initialData.config.filter);
	const [skipFailed, setSkipFailed] = useState(true);

	// Auto-save comparison config
	useEffect(() => {
		postMessage({
			command: 'saveComparisonConfig',
			config: {
				featureString,
				xAxis,
				yAxis,
				chartType,
				filter,
			},
		});
	}, [featureString, xAxis, yAxis, chartType, filter]);

	return (
		<div style={{ padding: '20px' }}>
			<ControlPanel
				featureString={featureString}
				xAxis={xAxis}
				yAxis={yAxis}
				chartType={chartType}
				skipFailed={skipFailed}
				filter={filter}
				onFeatureStringChange={setFeatureString}
				onXAxisChange={setXAxis}
				onYAxisChange={setYAxis}
				onChartTypeChange={setChartType}
				onSkipFailedChange={setSkipFailed}
				onFilterChange={setFilter}
			/>

			<StatsTable data={initialData} featureString={featureString} filter={filter} />

			<ComparisonChart
				data={initialData}
				featureString={featureString}
				xAxis={xAxis}
				yAxis={yAxis}
				chartType={chartType}
				skipFailed={skipFailed}
				filter={filter}
			/>
		</div>
	);
}
