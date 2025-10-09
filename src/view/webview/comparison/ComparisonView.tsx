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
	const [data, setData] = useState(initialData);
	const [featureString, setFeatureString] = useState(initialData.config.featureString);
	const [xAxis, setXAxis] = useState(initialData.config.xAxis);
	const [yAxis, setYAxis] = useState(initialData.config.yAxis);
	const [chartType, setChartType] = useState<'line' | 'scatter'>(initialData.config.chartType);
	const [filter, setFilter] = useState(initialData.config.filter);
	const [skipFailed, setSkipFailed] = useState(true);

	// Listen for data updates from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.command === 'updateData') {
				setData(message.data);
				// Update config from new data
				setFeatureString(message.data.config.featureString);
				setXAxis(message.data.config.xAxis);
				setYAxis(message.data.config.yAxis);
				setChartType(message.data.config.chartType);
				setFilter(message.data.config.filter);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

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

			<ComparisonChart
				data={data}
				featureString={featureString}
				xAxis={xAxis}
				yAxis={yAxis}
				chartType={chartType}
				skipFailed={skipFailed}
				filter={filter}
			/>

			<StatsTable data={data} featureString={featureString} filter={filter} />
		</div>
	);
}
