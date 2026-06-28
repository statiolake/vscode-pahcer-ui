import {
  type ActiveElement,
  CategoryScale,
  type ChartEvent,
  Chart as ChartJS,
  type ChartType,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { useMemo, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import {
  buildChartVariables,
  buildGroupChartVariables,
  chartVariablesToScalars,
} from '../../shared/utils/chartVariables';
import { evaluateExpression } from '../../shared/utils/expression';
import { parseFeatures } from '../../shared/utils/features';
import { postMessage } from '../../shared/utils/vscode';
import type { ChartDataPoint, ComparisonData } from '../types';

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
          label: (context: TooltipItem<ChartType>) => {
            const point = context.raw as ChartDataPoint;
            const lines = [`${context.dataset.label}: ${point.y.toLocaleString()}`];

            if (point.group && point.group.length > 1) {
              lines.push(`(${point.group.length} 件を集約)`);
              lines.push(`x: ${point.x}`);
            } else {
              lines.push(`seed: ${point.seed}`);
              lines.push(`x: ${point.x}`);
              if (point.variables) {
                lines.push(`vars: ${JSON.stringify(point.variables)}`);
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
          <button
            type="button"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              background: 'none',
              border: 'none',
              cursor: 'default',
              padding: 0,
            }}
            onClick={handleClosePopup}
            aria-label="Close popup"
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
                <button
                  key={item.seed}
                  type="button"
                  onClick={() => {
                    handleSeedClick(popup.point.resultId, item.seed);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--vscode-textLink-foreground)',
                    textDecoration: 'none',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
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
                </button>
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

  const datasets = results.map((result, _index) => {
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
        const variables = buildChartVariables({
          caseData: {
            seed,
            score: testCase.score,
            relativeScore: testCase.relativeScore,
            executionTime: testCase.executionTime,
          },
          features,
          inputLine,
          stderrVars: stderrData[result.id]?.[seed] || {},
        });

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
      groupedByX.get(key)?.push(seedData);
    }

    // Step 3: For each group, evaluate Y axis with arrays
    const chartData: ChartDataPoint[] = [];
    for (const [xValue, group] of groupedByX.entries()) {
      const variables = buildGroupChartVariables({
        group: group.map((d) => ({
          seed: d.seed,
          caseData: {
            seed: d.seed,
            score: d.testCase.score,
            relativeScore: d.testCase.relativeScore,
            executionTime: d.testCase.executionTime,
          },
          inputLine: d.inputLine,
        })),
        features,
        getStderrVars: (seed) => stderrData[result.id]?.[seed] || {},
      });

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
              variables: chartVariablesToScalars(
                buildChartVariables({
                  caseData: {
                    seed: group[i].seed,
                    score: group[i].testCase.score,
                    relativeScore: group[i].testCase.relativeScore,
                    executionTime: group[i].testCase.executionTime,
                  },
                  features,
                  inputLine: group[i].inputLine,
                  stderrVars: stderrData[result.id]?.[group[i].seed] || {},
                }),
              ),
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
              const singleVars = buildChartVariables({
                caseData: {
                  seed: g.seed,
                  score: g.testCase.score,
                  relativeScore: g.testCase.relativeScore,
                  executionTime: g.testCase.executionTime,
                },
                features,
                inputLine: g.inputLine,
                stderrVars: stderrData[result.id]?.[g.seed] || {},
              });

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
