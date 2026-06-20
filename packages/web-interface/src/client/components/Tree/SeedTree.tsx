import type {
  TreeSeedExecution,
  TreeSeedStats,
} from '@pahcer/core/application/dtos/pahcerTreeData';

import { formatExecutionTime, formatSeed, seedExecutionLabel } from '../../utils/format';
import { EmptyState } from '../common/EmptyState';
import { IconCheck, IconCross, IconHash, IconQuestion } from './icons';

type SeedTreeProps = {
  seeds: TreeSeedStats[];
  openSeed: number | null;
  executions: TreeSeedExecution[];
  selectedExecutionIds: string[];
  onOpenSeed: (seed: number) => void;
  onToggleExecution: (executionId: string) => void;
  onSelectCase: (executionId: string, seed: number) => void;
};

export function SeedTree(props: SeedTreeProps) {
  if (props.seeds.length === 0) {
    return <EmptyState text="シードがありません" />;
  }

  return (
    <div className="tree">
      {props.seeds.map((seed) => (
        <div className="treeGroup" key={seed.seed}>
          <div className="treeRow seedRow">
            <button
              type="button"
              className="disclosure"
              onClick={() => props.onOpenSeed(seed.seed)}
              aria-label={props.openSeed === seed.seed ? '閉じる' : '開く'}
            >
              {props.openSeed === seed.seed ? '▼' : '▶'}
            </button>
            <IconHash color="muted" />
            <button type="button" className="treeLabel" onClick={() => props.onOpenSeed(seed.seed)}>
              {formatSeed(seed.seed)}
            </button>
            <span className="description">
              {seed.count} runs · Avg: {seed.averageScore.toFixed(2)}
            </span>
          </div>
          {props.openSeed === seed.seed && (
            <div className="children">
              {props.executions.map((execution) => (
                <div
                  className={seedExecutionClassName(execution)}
                  key={execution.execution.id}
                  title={execution.testCase.errorMessage || undefined}
                >
                  <input
                    type="checkbox"
                    className="treeCheckbox"
                    checked={props.selectedExecutionIds.includes(execution.execution.id)}
                    onChange={() => props.onToggleExecution(execution.execution.id)}
                    aria-label={`${execution.execution.shortTitle} を比較対象にする`}
                  />
                  {seedExecutionIcon(execution)}
                  <button
                    type="button"
                    className="treeLabel"
                    onClick={() => props.onSelectCase(execution.execution.id, seed.seed)}
                  >
                    {seedExecutionLabel(execution)}
                  </button>
                  <span className="description">
                    {formatExecutionTime(execution.testCase.executionTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function seedExecutionClassName(execution: TreeSeedExecution): string {
  return [
    'treeRow',
    'caseRow',
    'seedExecutionRow',
    execution.isLatest ? 'latest' : '',
    isFailedSeedExecution(execution) ? 'failed' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function seedExecutionIcon(execution: TreeSeedExecution) {
  if (!execution.testCase.foundOutput) {
    return <IconQuestion color="muted" />;
  }

  if (isFailedSeedExecution(execution)) {
    return <IconCross color="danger" />;
  }

  return <IconCheck color="success" />;
}

function isFailedSeedExecution(execution: TreeSeedExecution): boolean {
  return (
    execution.testCase.foundOutput &&
    (execution.testCase.score === 0 || Boolean(execution.testCase.errorMessage))
  );
}
