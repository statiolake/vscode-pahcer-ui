import { useEffect, useMemo, useState } from 'react';

import type { CaseFileKind, FileView, SelectedCase } from '../../types';
import { formatSeed } from '../../utils/format';
import { caseFileKindLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';

type CasePanelProps = {
  selectedCase: SelectedCase;
  fileView: FileView | null;
  onOpenFile: (kind: CaseFileKind) => void;
};

const caseFileKinds: CaseFileKind[] = ['input', 'output', 'error'];

export function CasePanel(props: CasePanelProps) {
  const [selectedKind, setSelectedKind] = useState<CaseFileKind>('input');
  const [pendingKind, setPendingKind] = useState<CaseFileKind | null>(null);
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
    setPendingKind('input');
    props.onOpenFile('input');
  }, [props.selectedCase.executionId, props.selectedCase.seed]);

  useEffect(() => {
    if (activeFile) {
      setPendingKind(null);
    }
  }, [activeFile]);

  function selectKind(kind: CaseFileKind) {
    setSelectedKind(kind);
    setPendingKind(kind);
    props.onOpenFile(kind);
  }

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
      {activeFile ? (
        <CodeBlock
          title={caseFileKindLabel(selectedKind)}
          subtitle={activeFile.path}
          content={activeFile.content}
        />
      ) : pendingKind === selectedKind ? (
        <EmptyState text="読み込み中" />
      ) : (
        <EmptyState text="ファイルを選択してください" />
      )}
    </div>
  );
}
