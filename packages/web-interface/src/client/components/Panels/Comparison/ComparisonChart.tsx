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

import type { ChartDataPoint, ComparisonViewReadModel } from './types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  chart: ComparisonViewReadModel['chart'];
  chartType: 'line' | 'scatter';
  onShowVisualizer: (resultId: string, seed: number) => void;
}

interface PopupState {
  x: number;
  y: number;
  point: ChartDataPoint;
}

export function ComparisonChart({ chart, chartType, onShowVisualizer }: Props) {
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

  const textColor = getCssVariable('--text', 'CanvasText');
  const gridColor = getCssVariable('--line', 'ButtonBorder');
  const tooltipBackgroundColor = getCssVariable('--chart-tooltip-bg', 'CanvasText');
  const tooltipTextColor = getCssVariable('--chart-tooltip-text', 'Canvas');

  const handlePointClick = (event: ChartEvent, elements: ActiveElement[]) => {
    if (!Array.isArray(elements) || elements.length === 0) {
      return;
    }

    const element = elements[0] as { datasetIndex: number; index: number };
    const point = chartData.datasets[element.datasetIndex]?.data[element.index];
    if (!point || !event.native || !(event.native instanceof MouseEvent)) {
      return;
    }

    if (point.group && point.group.length > 1) {
      setPopup({
        x: event.native.clientX,
        y: event.native.clientY,
        point,
      });
      return;
    }

    onShowVisualizer(point.resultId, point.seed);
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
        backgroundColor: tooltipBackgroundColor,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
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
    onShowVisualizer(resultId, seed);
    setPopup(null);
  };

  return (
    <div className="comparisonChart">
      {chartType === 'line' ? (
        <Line data={chartData} options={options} />
      ) : (
        <Scatter data={chartData} options={options} />
      )}

      {popup && (
        <>
          <button
            type="button"
            className="comparisonPopupBackdrop"
            onClick={() => setPopup(null)}
            aria-label="Close popup"
          />
          <div className="comparisonPopup" style={{ left: popup.x, top: popup.y }}>
            <div className="comparisonPopupTitle">集約された Seed (x={popup.point.x})</div>
            <div className="comparisonPopupList">
              {popup.point.group?.map((item) => (
                <button
                  key={item.seed}
                  type="button"
                  className="comparisonPopupItem"
                  onClick={() => handleSeedClick(popup.point.resultId, item.seed)}
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

function getCssVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}
