import { useMemo } from 'react';

import type { FileView, SourcePreparation } from '../../types';
import { sourcePreparationStatusLabel } from '../../utils/labels';
import { CodeBlock } from '../common/CodeBlock';
import { EmptyState } from '../common/EmptyState';

type SourcePanelProps = {
  preparation: SourcePreparation | null;
  preparationPending: boolean;
  preparationError: string | null;
  sourceView: FileView | null;
  sourceFilePending: string | null;
  sourceFileError: { file: string; message: string } | null;
  selectedFile: string;
  executionId: string;
  executionLabel: string;
  onSelectFile: (file: string) => void;
};

export function SourcePanel(props: SourcePanelProps) {
  const preparation =
    props.preparation?.executionId === props.executionId ? props.preparation : null;
  const files = preparation?.status === 'ready' ? preparation.files : [];
  const selectedFile = files.includes(props.selectedFile) ? props.selectedFile : '';
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

  function selectFile(file: string) {
    props.onSelectFile(file);
  }

  const sourceFileError =
    props.sourceFileError?.file === selectedFile ? props.sourceFileError.message : null;
  const sourceFilePending = props.sourceFilePending === selectedFile;

  return (
    <div className="panelContent">
      <div className="panelHeader">
        <h2>ソース ({props.executionLabel})</h2>
      </div>
      {props.preparationPending && <EmptyState text="ソースファイルを読み込み中..." />}
      {!props.preparationPending && !preparation && props.preparationError && (
        <EmptyState text="ソースファイルの読み込みに失敗しました" hint={props.preparationError} />
      )}
      {!props.preparationPending && !preparation && !props.preparationError && (
        <EmptyState text="ソースファイルを読み込み中..." />
      )}
      {!props.preparationPending && preparation && preparation.status !== 'ready' && (
        <EmptyState text={sourcePreparationStatusLabel(preparation.status)} />
      )}
      {!props.preparationPending && preparation?.status === 'ready' && (
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
          {sourceFilePending ? (
            <EmptyState text={`${selectedFile} を読み込み中...`} />
          ) : activeSource ? (
            <CodeBlock
              title={activeSource.title}
              subtitle={activeSource.path}
              content={activeSource.content}
            />
          ) : sourceFileError ? (
            <EmptyState text="ソースファイルの読み込みに失敗しました" hint={sourceFileError} />
          ) : (
            <EmptyState text="ファイルを選択してください" />
          )}
        </>
      )}
    </div>
  );
}
