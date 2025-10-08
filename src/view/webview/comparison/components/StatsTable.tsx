import React, { useMemo } from 'react';
import type { ComparisonData, StatsRow } from '../types';
import { evaluateExpression } from '../../shared/utils/expression';
import { parseFeatures } from '../../shared/utils/features';
import { parseStderrVariables } from '../../shared/utils/stderr';

interface Props {
	data: ComparisonData;
	featureString: string;
	filter: string;
}

export function StatsTable({ data, featureString, filter }: Props) {
	const { stats, filteredCount, totalCount } = useMemo(
		() => calculateStats(data, featureString, filter),
		[data, featureString, filter],
	);

	const sectionStyle = {
		marginBottom: '20px',
		padding: '10px',
		border: '1px solid var(--vscode-panel-border)',
	};

	const tableStyle = {
		width: '100%',
		borderCollapse: 'collapse' as const,
	};

	const cellStyle = {
		padding: '8px',
		textAlign: 'left' as const,
	};

	const thStyle = {
		...cellStyle,
		borderBottom: '1px solid var(--vscode-panel-border)',
		fontWeight: 'bold' as const,
	};

	const filterInfo = filter.trim() !== '' ? ` (フィルタ後: ${filteredCount}/${totalCount})` : '';

	return (
		<div style={sectionStyle}>
			<div style={{ marginBottom: '10px', fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)' }}>
				統計情報{filterInfo}
			</div>
			<table style={tableStyle}>
				<thead>
					<tr>
						<th style={thStyle}>実行</th>
						<th style={thStyle}>スコア合計</th>
						<th style={thStyle}>Mean ± SD</th>
						<th style={thStyle}>#Best</th>
						<th style={thStyle}>#Unique</th>
						<th style={thStyle}>#Fail</th>
					</tr>
				</thead>
				<tbody>
					{stats.map((stat, index) => (
						<tr key={index}>
							<td style={cellStyle}>{stat.name}</td>
							<td style={cellStyle}>{stat.totalScore.toLocaleString()}</td>
							<td style={cellStyle}>
								{stat.mean.toLocaleString()} ± {stat.sd.toLocaleString()}
							</td>
							<td style={cellStyle}>{stat.bestCount}</td>
							<td style={cellStyle}>{stat.uniqueBestCount}</td>
							<td style={cellStyle}>{stat.failCount}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function calculateStats(
	data: ComparisonData,
	featuresStr: string,
	filter: string,
): { stats: StatsRow[]; filteredCount: number; totalCount: number } {
	const stats: StatsRow[] = [];
	const { results, seeds, inputData, stderrData } = data;
	const features = parseFeatures(featuresStr);

	// Apply filter to determine which seeds to include
	const filteredSeeds = seeds.filter((seed) => {
		if (filter.trim() === '') return true;

		const inputLine = inputData[seed] || '';
		const variables: Record<string, number[]> = {};
		variables.seed = [seed];

		// We need at least one result to get absScore/relScore/executionTime
		// Use the first result's case for filtering
		const firstResult = results[0];
		const testCase = firstResult?.cases.find((c) => c.seed === seed);
		if (!testCase) return false;

		variables.absScore = [testCase.score];
		variables.relScore = [testCase.relativeScore];
		variables.msec = [testCase.executionTime * 1000];

		const featureValues = parseFeatures(inputLine);
		for (let i = 0; i < features.length && i < featureValues.length; i++) {
			variables[features[i]] = [Number(featureValues[i]) || 0];
		}

		// Parse stderr variables
		const stderr = stderrData[firstResult.id]?.[seed] || '';
		const stderrVars = parseStderrVariables(stderr);
		for (const [varName, value] of Object.entries(stderrVars)) {
			variables[`$${varName}`] = [value];
		}

		try {
			const filterResult = evaluateExpression(filter, variables);
			return filterResult[0] === 1;
		} catch (e) {
			console.warn(`Filter evaluation failed for seed ${seed}:`, e);
			return false;
		}
	});

	// Calculate best scores for each filtered seed
	const bests: Record<number, number> = {};
	for (const seed of filteredSeeds) {
		let maxScore = 0;
		for (const result of results) {
			const testCase = result.cases.find((c) => c.seed === seed);
			if (testCase && testCase.score > maxScore) {
				maxScore = testCase.score;
			}
		}
		bests[seed] = maxScore;
	}

	for (const result of results) {
		const scores: number[] = [];
		let totalScore = 0;
		let bestCount = 0;
		let uniqueBestCount = 0;
		let failCount = 0;

		for (const seed of filteredSeeds) {
			const testCase = result.cases.find((c) => c.seed === seed);
			if (testCase) {
				if (testCase.score > 0) {
					scores.push(testCase.score);
					totalScore += testCase.score;

					if (testCase.score === bests[seed] && bests[seed] > 0) {
						bestCount++;
						// Check if this is unique best (among filtered seeds)
						const othersWithSameScore = results.filter((r) => {
							const tc = r.cases.find((c) => c.seed === seed);
							return tc && tc.score === bests[seed];
						}).length;
						if (othersWithSameScore === 1) {
							uniqueBestCount++;
						}
					}
				} else {
					failCount++;
				}
			} else {
				failCount++;
			}
		}

		const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
		const variance =
			scores.length > 0 ? scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length : 0;
		const sd = Math.sqrt(variance);

		stats.push({
			name: result.time,
			totalScore,
			mean: Math.round(mean),
			sd: Math.round(sd),
			bestCount,
			uniqueBestCount,
			failCount,
		});
	}

	return { stats, filteredCount: filteredSeeds.length, totalCount: seeds.length };
}
