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
    <ul className="tree" aria-label="シード">
      {props.seeds.map((seed) => {
        const isOpen = props.openSeed === seed.seed;
        const seedLabel = `${formatSeed(seed.seed)} - ${seed.count} runs - Avg: ${seed.averageScore.toFixed(2)}`;

        return (
          <li className="treeGroup" key={seed.seed} aria-label={seedLabel}>
            <div className="treeRow seedRow">
              <button
                type="button"
                className="disclosure"
                onClick={() => props.onOpenSeed(seed.seed)}
                aria-label={`${seedLabel} を${isOpen ? '閉じる' : '開く'}`}
                aria-expanded={isOpen}
              >
                {isOpen ? '▼' : '▶'}
              </button>
              <IconHash color="muted" />
              <button
                type="button"
                className="treeLabel"
                onClick={() => props.onOpenSeed(seed.seed)}
                aria-label={seedLabel}
                aria-expanded={isOpen}
              >
                {formatSeed(seed.seed)}
              </button>
              <span className="description">
                {seed.count} runs · Avg: {seed.averageScore.toFixed(2)}
              </span>
            </div>
            {isOpen && (
              <ul className="children" aria-label={`${seedLabel} の実行結果`}>
                {props.executions.map((execution) => {
                  const executionTime = formatExecutionTime(execution.testCase.executionTime);
                  const rowLabel = `${seedExecutionLabel(execution)} - ${executionTime}`;

                  return (
                    <li key={execution.execution.id} aria-label={rowLabel}>
                      <div
                        className={seedExecutionClassName(execution)}
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
                          aria-label={rowLabel}
                        >
                          {seedExecutionLabel(execution)}
                        </button>
                        <span className="description">{executionTime}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
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
