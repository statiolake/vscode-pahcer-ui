import type { PahcerStatusView } from '@pahcer/core/application/dtos/pahcerUIState';

import { IconButton } from '../common/IconButton';
import { IconPlay, IconRefresh, IconSettings } from '../Tree/icons';

type TopBarProps = {
  status: PahcerStatusView | undefined;
  workspaceRoot: string;
  onRun: () => void;
  onOpenRunOptions: () => void;
  onReload: () => void;
};

export function TopBar(props: TopBarProps) {
  return (
    <header className="commandBar">
      <div className="brand">
        <strong>Pahcer</strong>
        <span>{props.workspaceRoot}</span>
      </div>
      <div className="commandBarCenter" aria-hidden="true" />
      <div className="topBarActions">
        <IconButton
          icon={<IconPlay />}
          label="テストを実行"
          variant="primary"
          size="md"
          disabled={props.status !== 'ready'}
          onClick={props.onRun}
        />
        <IconButton
          icon={<IconSettings />}
          label="詳細実行オプション"
          variant="ghost"
          disabled={props.status !== 'ready'}
          onClick={props.onOpenRunOptions}
        />
        <IconButton
          icon={<IconRefresh />}
          label="結果を更新"
          variant="ghost"
          onClick={props.onReload}
        />
      </div>
    </header>
  );
}
