import type {
  ExecutionSortOrder,
  GroupingMode,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';
import type { ReactNode } from 'react';

import type { WebPreferences } from '../../types';
import { Button } from '../common/Button';

const executionSortOptions: Array<{ value: ExecutionSortOrder; label: string }> = [
  { value: 'seedAsc', label: 'シードの昇順' },
  { value: 'seedDesc', label: 'シードの降順' },
  { value: 'relativeScoreDesc', label: '相対スコアの降順' },
  { value: 'relativeScoreAsc', label: '相対スコアの昇順' },
  { value: 'absoluteScoreDesc', label: '絶対スコアの降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコアの昇順' },
];

const seedSortOptions: Array<{ value: SeedSortOrder; label: string }> = [
  { value: 'executionAsc', label: '実行の昇順' },
  { value: 'executionDesc', label: '実行の降順' },
  { value: 'absoluteScoreDesc', label: '絶対スコアの降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコアの昇順' },
];

type SideBarProps = {
  mode: GroupingMode;
  preferences: WebPreferences;
  selectedCount: number;
  onRun: () => void;
  onOpenRunOptions: () => void;
  onReload: () => void;
  onUpdatePreferences: (next: Partial<WebPreferences>) => void;
  children: ReactNode;
};

export function SideBar(props: SideBarProps) {
  const sortOptions = props.mode === 'byExecution' ? executionSortOptions : seedSortOptions;
  const sortValue =
    props.mode === 'byExecution'
      ? props.preferences.executionSortOrder
      : props.preferences.seedSortOrder;

  return (
    <aside className="sideBar">
      <div className="resultHeader">
        <div>
          <h2>Pahcer Results</h2>
          <p>{props.selectedCount} 件を選択中</p>
        </div>
        <div className="contextActions">
          <Button variant="primary" onClick={props.onRun}>
            実行
          </Button>
          <Button onClick={props.onOpenRunOptions}>条件指定</Button>
          <Button onClick={props.onReload}>更新</Button>
        </div>
      </div>
      <div className="treeToolbar">
        <button
          type="button"
          className={props.mode === 'byExecution' ? 'active' : ''}
          onClick={() => props.onUpdatePreferences({ groupingMode: 'byExecution' })}
        >
          実行
        </button>
        <button
          type="button"
          className={props.mode === 'bySeed' ? 'active' : ''}
          onClick={() => props.onUpdatePreferences({ groupingMode: 'bySeed' })}
        >
          Seed
        </button>
        <select
          value={sortValue}
          onChange={(event) =>
            props.onUpdatePreferences(
              props.mode === 'byExecution'
                ? { executionSortOrder: event.target.value as ExecutionSortOrder }
                : { seedSortOrder: event.target.value as SeedSortOrder },
            )
          }
        >
          {sortOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {props.children}
    </aside>
  );
}
