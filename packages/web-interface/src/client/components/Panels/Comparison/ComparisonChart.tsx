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
  type PointStyle,
  Title,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';

import { focusFirstElement, trapFocus } from '../../common/focusScope';
import type { ChartDataPoint, ComparisonViewReadModel } from './types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  chart: ComparisonViewReadModel['chart'];
  chartType: 'line' | 'scatter';
  onShowVisualizer: (resultId: string, seed: number) => void;
}

interface PopupState {
  anchorX: number;
  anchorY: number;
  point: ChartDataPoint;
}

interface PopupPosition {
  left: number;
  top: number;
}

interface DatasetStyle {
  color: string;
  borderDash: readonly number[];
  pointStyle: PointStyle;
}

const COMPARISON_DATASET_STYLES = [
  { color: '#047857', borderDash: [], pointStyle: 'circle' },
  { color: '#1D4ED8', borderDash: [6, 4], pointStyle: 'triangle' },
  { color: '#7E22CE', borderDash: [2, 3], pointStyle: 'rect' },
  { color: '#B45309', borderDash: [8, 3, 2, 3], pointStyle: 'cross' },
  { color: '#B91C1C', borderDash: [10, 4], pointStyle: 'rectRot' },
  { color: '#4B5563', borderDash: [4, 2, 1, 2], pointStyle: 'star' },
  { color: '#BE185D', borderDash: [1, 3], pointStyle: 'crossRot' },
  { color: '#0E7490', borderDash: [6, 2, 2, 2], pointStyle: 'rectRounded' },
] satisfies readonly [DatasetStyle, ...DatasetStyle[]];

export function ComparisonChart({ chart, chartType, onShowVisualizer }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const popupTitleId = useId();

  const chartData = useMemo(
    () => ({
      datasets: chart.datasets.map((dataset, datasetIndex) => {
        const style = getDatasetStyle(datasetIndex);
        return {
          label: dataset.label,
          data: dataset.data,
          borderColor: style.color,
          backgroundColor: style.color,
          borderDash: [...style.borderDash],
          pointStyle: style.pointStyle,
          showLine: chartType === 'line',
          pointRadius: 3,
        };
      }),
    }),
    [chart, chartType],
  );

  useLayoutEffect(() => {
    if (!popup) {
      return undefined;
    }

    const popupElement = popupRef.current;
    if (!popupElement) {
      return undefined;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const updatePopupPosition = () => {
      const nextPosition = calculatePopupPosition(popupElement, popup.anchorX, popup.anchorY);
      setPopupPosition((currentPosition) =>
        currentPosition?.left === nextPosition.left && currentPosition.top === nextPosition.top
          ? currentPosition
          : nextPosition,
      );
    };

    updatePopupPosition();
    focusFirstElement(popupElement);

    window.addEventListener('resize', updatePopupPosition);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePopupPosition);
    resizeObserver?.observe(popupElement);

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      resizeObserver?.disconnect();

      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      previouslyFocusedElementRef.current = null;

      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
    };
  }, [popup]);

  const textColor = getCssVariable('--text', 'CanvasText');
  const gridColor = getCssVariable('--line', 'ButtonBorder');
  const tooltipBackgroundColor = getCssVariable('--chart-tooltip-bg', 'CanvasText');
  const tooltipTextColor = getCssVariable('--chart-tooltip-text', 'Canvas');

  const closePopup = useCallback(() => {
    setPopup(null);
    setPopupPosition(null);
  }, []);

  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup();
        return;
      }

      if (event.key === 'Tab') {
        trapFocus(event, popupRef.current);
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [closePopup, popup]);

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
      setPopupPosition(null);
      setPopup({
        anchorX: event.native.clientX,
        anchorY: event.native.clientY,
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
    closePopup();
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
            onClick={closePopup}
            aria-label="ポップアップを閉じる"
            tabIndex={-1}
          />
          <div
            ref={popupRef}
            className="comparisonPopup"
            style={{
              left: popupPosition?.left ?? popup.anchorX,
              top: popupPosition?.top ?? popup.anchorY,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={popupTitleId}
            tabIndex={-1}
          >
            <div className="comparisonPopupHeader">
              <div id={popupTitleId} className="comparisonPopupTitle">
                集約された Seed (x={popup.point.x})
              </div>
              <button
                type="button"
                className="comparisonPopupClose"
                aria-label="閉じる"
                onClick={closePopup}
              >
                ×
              </button>
            </div>
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

function getDatasetStyle(datasetIndex: number): DatasetStyle {
  return COMPARISON_DATASET_STYLES[datasetIndex % COMPARISON_DATASET_STYLES.length];
}

function calculatePopupPosition(
  popupElement: HTMLElement,
  anchorX: number,
  anchorY: number,
): PopupPosition {
  const popupRect = popupElement.getBoundingClientRect();
  const popupOffset = getCssPixelVariable('--space-3', 12);
  const viewportMargin = getCssPixelVariable('--space-2', 8);
  const maxLeft = window.innerWidth - popupRect.width - viewportMargin;
  const maxTop = window.innerHeight - popupRect.height - viewportMargin;

  return {
    left: clamp(anchorX + popupOffset, viewportMargin, Math.max(viewportMargin, maxLeft)),
    top: clamp(anchorY + popupOffset, viewportMargin, Math.max(viewportMargin, maxTop)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getCssPixelVariable(name: string, fallback: number): number {
  const value = Number.parseFloat(getCssVariable(name, `${fallback}px`));
  return Number.isFinite(value) ? value : fallback;
}

function getCssVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}
