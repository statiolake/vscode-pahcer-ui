import type { TreeExecutionStats } from '@pahcer/core/application/dtos/pahcerTreeData';

import { IconInfo } from './icons';

type SummaryRowProps = {
  stats: TreeExecutionStats;
};

export function SummaryRow(props: SummaryRowProps) {
  const rowLabel = `AC: ${props.stats.acCount}/${props.stats.caseCount} - Total Score: ${props.stats.totalScore.toLocaleString()} - Max Time: ${(props.stats.maxExecutionTime * 1000).toFixed(0)}ms`;

  return (
    <li className="treeRow summaryRow" aria-label={rowLabel}>
      <IconInfo color="muted" />
      <span className="treeLabel">
        AC: {props.stats.acCount}/{props.stats.caseCount} · Total Score:{' '}
        {props.stats.totalScore.toLocaleString()} · Max Time:{' '}
        {(props.stats.maxExecutionTime * 1000).toFixed(0)}ms
      </span>
    </li>
  );
}
