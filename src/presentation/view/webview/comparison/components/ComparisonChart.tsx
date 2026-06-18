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
import { postMessage } from '../../shared/utils/vscode';
import type { ChartDataPoint, ComparisonViewReadModel } from '../types';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  chart: ComparisonViewReadModel['chart'];
  chartType: 'line' | 'scatter';
}

interface PopupState {
  x: number;
  y: number;
  point: ChartDataPoint;
}

export function ComparisonChart({ chart, chartType }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const chartData = useMemo(
    () => ({
      datasets: chart.datasets.map((dataset) => {
        const color = getColorForResultId(dataset.resultId);
        return {
          label: dataset.label,
          data: dataset.data,
          borderColor: color,
          backgroundColor: color,
          showLine: chartType === 'line',
          pointRadius: 3,
        };
      }),
    }),
    [chart, chartType],
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
          text: chart.xAxisLabel,
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
          text: chart.yAxisLabel,
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
