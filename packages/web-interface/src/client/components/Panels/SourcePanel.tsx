import { useEffect, useMemo, useState } from 'react';

import type { FileView, SourcePreparation } from '../../types';
import { sourcePreparationStatusLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';

type SourcePanelProps = {
  preparation: SourcePreparation | null;
  sourceView: FileView | null;
  executionId: string;
  executionLabel: string;
  onLoadFile: (file: string) => void;
};

export function SourcePanel(props: SourcePanelProps) {
  const [selectedFile, setSelectedFile] = useState('');
  const preparation =
    props.preparation?.executionId === props.executionId ? props.preparation : null;
  const files = preparation?.status === 'ready' ? preparation.files : [];
  const activeSource = useMemo(() => {
    if (
      !props.sourceView ||
      props.sourceView.executionId !== props.executionId ||
      props.sourceView.title !== selectedFile
    ) {
      return null;
    }
    return props.sourceView;
  }, [props.executionId, props.sourceView, selectedFile]);

  useEffect(() => {
    if (preparation?.status !== 'ready') {
      setSelectedFile('');
      return;
    }

    setSelectedFile((current) => {
      if (current && preparation.files.includes(current)) {
        return current;
      }
      if (props.sourceView?.title && preparation.files.includes(props.sourceView.title)) {
        return props.sourceView.title;
      }
      return '';
    });
  }, [preparation, props.sourceView?.title]);

  function selectFile(file: string) {
    setSelectedFile(file);
    if (file) {
      props.onLoadFile(file);
    }
  }

  return (
    <div className="panelContent">
      <div className="panelHeader">
        <h2>ソース ({props.executionLabel})</h2>
      </div>
      {preparation && preparation.status !== 'ready' && (
        <EmptyState text={sourcePreparationStatusLabel(preparation.status)} />
      )}
      {preparation?.status === 'ready' && (
        <>
          <select
            className="sourceFileSelect"
            value={selectedFile}
            onChange={(event) => selectFile(event.currentTarget.value)}
            aria-label="ソースファイル"
          >
            <option value="">ファイルを選択</option>
            {files.map((file) => (
              <option value={file} key={file}>
                {file}
              </option>
            ))}
          </select>
          {activeSource ? (
            <CodeBlock
              title={activeSource.title}
              subtitle={activeSource.path}
              content={activeSource.content}
            />
          ) : selectedFile ? (
            <EmptyState text="読み込み中" />
          ) : (
            <EmptyState text="ファイルを選択してください" />
          )}
        </>
      )}
      {!preparation && <EmptyState text="ソースファイルを読み込んでください" />}
    </div>
  );
}
