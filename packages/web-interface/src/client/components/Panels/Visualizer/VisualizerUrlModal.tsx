import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';

import { toErrorMessage } from '../../../utils/format';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';

type VisualizerUrlModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void | Promise<void>;
  downloading?: boolean;
};

export function VisualizerUrlModal(props: VisualizerUrlModalProps) {
  const formId = useId();
  const errorId = useId();
  const [url, setUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationError = useMemo(() => validateVisualizerUrl(url), [url]);
  const displayedError = submitError ?? validationError;

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setUrl('');
    setSubmitError(null);
  }, [props.open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationError || props.downloading) {
      return;
    }

    setSubmitError(null);
    try {
      await props.onSubmit(url.trim());
    } catch (caught) {
      setSubmitError(`ダウンロードに失敗しました: ${toErrorMessage(caught)}`);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="ビジュアライザ URL"
      dismissible={!props.downloading}
      footer={
        <>
          <Button onClick={props.onClose} disabled={props.downloading}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            disabled={Boolean(validationError) || props.downloading}
          >
            {props.downloading ? 'ダウンロード中…' : 'ダウンロード'}
          </Button>
        </>
      }
    >
      <p className="visualizerUrlDescription">
        AtCoder 公式ビジュアライザの URL を入力してください
      </p>
      <form id={formId} onSubmit={handleSubmit}>
        <label className={displayedError ? 'fieldInvalid' : undefined}>
          URL
          <input
            type="text"
            value={url}
            placeholder="https://img.atcoder.jp/ahc999/xxxxx.html?lang=ja"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? errorId : undefined}
            disabled={props.downloading}
            onChange={(event) => {
              setUrl(event.target.value);
              setSubmitError(null);
            }}
          />
        </label>
        {displayedError && (
          <div className="fieldError visualizerUrlError" id={errorId}>
            {displayedError}
          </div>
        )}
      </form>
    </Modal>
  );
}

function validateVisualizerUrl(url: string): string | null {
  const value = url.trim();
  if (!value) {
    return 'URLを入力してください';
  }
  if (!value.startsWith('https://img.atcoder.jp/')) {
    return 'AtCoderの公式URLを入力してください';
  }

  const urlWithoutQuery = value.split('?')[0];
  if (!urlWithoutQuery.endsWith('.html')) {
    return 'HTMLファイルのURLを入力してください';
  }
  return null;
}
