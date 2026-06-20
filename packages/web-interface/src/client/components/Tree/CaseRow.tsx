import type { TreeTestCase } from '@pahcer/core/application/dtos/pahcerTreeData';

import { formatExecutionTime, formatNumber, formatSeed } from '../../utils/format';
import { IconCheck, IconCross, IconQuestion } from './icons';

type CaseRowProps = {
  testCase: TreeTestCase;
  relativeScore: number;
  onSelect: () => void;
};

export function CaseRow(props: CaseRowProps) {
  const failed =
    props.testCase.foundOutput &&
    (props.testCase.score === 0 || Boolean(props.testCase.errorMessage));

  return (
    <button
      type="button"
      className={failed ? 'treeRow caseRow failed' : 'treeRow caseRow'}
      onClick={props.onSelect}
      title={props.testCase.errorMessage || undefined}
    >
      {caseIcon(props.testCase)}
      <span className="treeLabel">
        {formatSeed(props.testCase.seed)}: {formatNumber(props.testCase.score)} (
        {props.relativeScore.toFixed(3)}%)
      </span>
      <span className="description">{formatExecutionTime(props.testCase.executionTime)}</span>
    </button>
  );
}

function caseIcon(testCase: TreeTestCase) {
  if (!testCase.foundOutput) {
    return <IconQuestion color="muted" />;
  }

  if (testCase.score === 0 || testCase.errorMessage) {
    return <IconCross color="danger" />;
  }

  return <IconCheck color="success" />;
}
