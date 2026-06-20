import type { PahcerStatusView } from '@pahcer/core/application/dtos/pahcerUIState';

import { statusLabel } from '../../utils/labels';

type TopBarProps = {
  status: PahcerStatusView | undefined;
  workspaceRoot: string;
};

export function TopBar(props: TopBarProps) {
  return (
    <header className="commandBar">
      <div className="brand">
        <strong>Pahcer</strong>
        <span>{props.workspaceRoot}</span>
      </div>
      <span className="statusChip">{statusLabel(props.status)}</span>
    </header>
  );
}
