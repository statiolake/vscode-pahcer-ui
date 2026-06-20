import type { DiffView } from '../../types';
import { diffStatusLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';

type DiffPanelProps = {
  diff: DiffView | null;
  selectedCount: number;
};

export function DiffPanel(props: DiffPanelProps) {
  if (!props.diff) {
    return <EmptyState text={`差分対象: ${props.selectedCount}/2 件`} />;
  }
  if (props.diff.status !== 'shown') {
    return <EmptyState text={diffStatusLabel(props.diff.status)} />;
  }
  if (!props.diff.files || props.diff.files.length === 0) {
    return <EmptyState text="表示対象の変更ファイルはありません" />;
  }
  return (
    <div className="panelContent diffList">
      {props.diff.files.map((file, index) => (
        <details className="diffFile" key={file.file} open={index < 3}>
          <summary>
            <span>{file.file}</span>
            <span className="diffStats">{formatDiffStats(file.patch)}</span>
          </summary>
          <CodeBlock title="Patch" subtitle={file.file} content={file.patch} language="diff" />
        </details>
      ))}
    </div>
  );
}

function formatDiffStats(patch: string): string {
  const lines = patch.split('\n');
  const added = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const removed = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
  return `+${added} / -${removed}`;
}
