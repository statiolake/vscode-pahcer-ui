import type { DiffView } from '../../types';
import { diffStatusLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';
import { IconChevronRight } from '../Tree/icons';

type DiffPanelProps = {
  diff: DiffView | null;
  selectedCount: number;
  pending: boolean;
  loadError: string | null;
};

export function DiffPanel(props: DiffPanelProps) {
  if (props.pending) {
    return <EmptyState text="差分を読み込み中..." hint={`差分対象: ${props.selectedCount}/2 件`} />;
  }
  if (!props.diff) {
    if (props.loadError) {
      return <EmptyState text="差分の読み込みに失敗しました" hint={props.loadError} />;
    }
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
      {props.diff.files.map((file, index) => {
        const { added, removed } = diffCounts(file.patch);

        return (
          <details className="diffFile" key={file.file} open={index < 3}>
            <summary>
              <IconChevronRight className="chevronIcon" />
              <span>{file.file}</span>
              <span className="diffStats">
                {added > 0 && <span className="diffAdded">+{added}</span>}
                {removed > 0 && <span className="diffRemoved">−{removed}</span>}
              </span>
            </summary>
            <CodeBlock title="Patch" subtitle={file.file} content={file.patch} language="diff" />
          </details>
        );
      })}
    </div>
  );
}

function diffCounts(patch: string): { added: number; removed: number } {
  const lines = patch.split('\n');
  const added = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const removed = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
  return { added, removed };
}
