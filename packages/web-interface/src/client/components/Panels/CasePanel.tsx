import { useEffect, useMemo, useState } from 'react';

import type { CaseFileKind, FileView, SelectedCase } from '../../types';
import { formatSeed } from '../../utils/format';
import { caseFileKindLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';

type CasePanelProps = {
  selectedCase: SelectedCase;
  fileView: FileView | null;
  pendingKind: CaseFileKind | null;
  loadError: { kind: CaseFileKind; message: string } | null;
  onOpenFile: (kind: CaseFileKind) => void;
};

const caseFileKinds: CaseFileKind[] = ['input', 'output', 'error'];

export function CasePanel(props: CasePanelProps) {
  const [selectedKind, setSelectedKind] = useState<CaseFileKind>('input');
  const activeFile = useMemo(() => {
    if (
      props.fileView?.kind !== selectedKind ||
      props.fileView.executionId !== props.selectedCase.executionId ||
      props.fileView.seed !== props.selectedCase.seed
    ) {
      return null;
    }
    return props.fileView;
  }, [props.fileView, props.selectedCase.executionId, props.selectedCase.seed, selectedKind]);

  // ケースが変わったら入力を自動ロード
  // biome-ignore lint/correctness/useExhaustiveDependencies: onOpenFile は親で安定参照
  useEffect(() => {
    setSelectedKind('input');
    props.onOpenFile('input');
  }, [props.selectedCase.executionId, props.selectedCase.seed]);

  function selectKind(kind: CaseFileKind) {
    setSelectedKind(kind);
    props.onOpenFile(kind);
  }

  const loadError = props.loadError?.kind === selectedKind ? props.loadError.message : null;
  const pending = props.pendingKind === selectedKind;

  return (
    <div className="panelContent">
      <div className="panelHeader">
        <h2>Seed {formatSeed(props.selectedCase.seed)}</h2>
      </div>
      <fieldset className="toggleGroup">
        <legend className="srOnly">ケースファイル</legend>
        {caseFileKinds.map((kind) => (
          <button
            type="button"
            key={kind}
            aria-pressed={selectedKind === kind}
            onClick={() => selectKind(kind)}
          >
            {caseFileKindLabel(kind)}
          </button>
        ))}
      </fieldset>
      {pending ? (
        <EmptyState text={`${caseFileKindLabel(selectedKind)}を読み込み中...`} />
      ) : activeFile ? (
        <CodeBlock
          title={caseFileKindLabel(selectedKind)}
          subtitle={activeFile.path}
          content={activeFile.content}
        />
      ) : loadError ? (
        <EmptyState
          text={`${caseFileKindLabel(selectedKind)}の読み込みに失敗しました`}
          hint={loadError}
        />
      ) : (
        <EmptyState text="ファイルを選択してください" />
      )}
    </div>
  );
}
