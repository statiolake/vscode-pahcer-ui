import React, { useMemo } from 'react';
import type { ComparisonData, StatsRow } from '../types';

interface Props {
	data: ComparisonData;
	features: string;
}

export function StatsTable({ data, features }: Props) {
	const stats = useMemo(() => calculateStats(data), [data]);

	const sectionStyle = {
		marginBottom: '20px',
		padding: '10px',
		border: '1px solid var(--vscode-panel-border)',
	};

	const tableStyle = {
		width: '100%',
		borderCollapse: 'collapse' as const,
		marginTop: '10px',
	};

	const cellStyle = {
		padding: '8px',
		textAlign: 'left' as const,
		borderBottom: '1px solid var(--vscode-panel-border)',
	};

	const thStyle = {
		...cellStyle,
		fontWeight: 'bold' as const,
	};

	return (
		<div style={sectionStyle}>
			<h3>統計情報</h3>
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

function calculateStats(data: ComparisonData): StatsRow[] {
	const stats: StatsRow[] = [];
	const { results, seeds } = data;

	// Calculate best scores for each seed
	const bests: Record<number, number> = {};
	for (const seed of seeds) {
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

		for (const seed of seeds) {
			const testCase = result.cases.find((c) => c.seed === seed);
			if (testCase) {
				if (testCase.score > 0) {
					scores.push(testCase.score);
					totalScore += testCase.score;

					if (testCase.score === bests[seed] && bests[seed] > 0) {
						bestCount++;
						// Check if this is unique best
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

	return stats;
}
