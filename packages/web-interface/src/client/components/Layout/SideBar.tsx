import type {
  ExecutionSortOrder,
  GroupingMode,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';
import type { ReactNode } from 'react';

import type { WebPreferences } from '../../types';
import { IconHash, IconSortAsc, IconTree } from '../Tree/icons';

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
        <span className="sectionLabel">RESULTS</span>
        {props.selectedCount > 0 && (
          <span className="chipBadge">{props.selectedCount} 件選択中</span>
        )}
      </div>
      <div className="treeToolbar">
        <fieldset className="toggleGroup">
          <legend className="srOnly">表示モード</legend>
          <button
            type="button"
            className={props.mode === 'byExecution' ? 'active' : ''}
            aria-pressed={props.mode === 'byExecution'}
            onClick={() => props.onUpdatePreferences({ groupingMode: 'byExecution' })}
          >
            <IconTree />
            <span>実行</span>
          </button>
          <button
            type="button"
            className={props.mode === 'bySeed' ? 'active' : ''}
            aria-pressed={props.mode === 'bySeed'}
            onClick={() => props.onUpdatePreferences({ groupingMode: 'bySeed' })}
          >
            <IconHash />
            <span>Seed</span>
          </button>
        </fieldset>
        <div className="sortControl">
          <IconSortAsc />
          <select
            aria-label="並び順"
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
      </div>
      {props.children}
    </aside>
  );
}
