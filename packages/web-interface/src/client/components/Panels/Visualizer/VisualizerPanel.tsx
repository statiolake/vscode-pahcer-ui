import type { RefObject } from 'react';

import { formatSeed } from '../../../utils/format';
import { EmptyState } from '../../common/EmptyState';
import { IconButton } from '../../common/IconButton';
import { IconExternal, IconRefresh } from '../../Tree/icons';

type VisualizerPanelProps = {
  src: string | null;
  externalSrc: string | null;
  pending: boolean;
  loadError: string | null;
  title?: {
    seed: number;
    execution?: string;
  };
  frameRef: RefObject<HTMLIFrameElement | null>;
  onFrameLoad: () => void;
  onResetVisualizer: () => void;
};

export function VisualizerPanel(props: VisualizerPanelProps) {
  if (!props.src) {
    return (
      <div className="visualizerPanel">
        {props.pending ? (
          <EmptyState text="ビジュアライザを確認中..." />
        ) : props.loadError ? (
          <EmptyState text="ビジュアライザを開けませんでした" hint={props.loadError} />
        ) : (
          <EmptyState text="ケースを選択してビジュアライザを開いてください" />
        )}
      </div>
    );
  }

  function openExternal() {
    if (!props.src) {
      return;
    }
    const opened = window.open(props.externalSrc ?? props.src, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
    }
  }

  return (
    <div className="visualizerPanel" aria-busy={props.pending}>
      <div className="visualizerToolbar">
        <div className="visualizerMeta">
          <span className="visualizerTitle">
            {props.title ? `Seed ${formatSeed(props.title.seed)}` : 'ビジュアライザ'}
          </span>
          {props.title?.execution && <span>実行: {props.title.execution}</span>}
        </div>
        <div className="visualizerActions">
          <IconButton
            icon={<IconRefresh />}
            label="再ダウンロード"
            size="sm"
            onClick={props.onResetVisualizer}
          />
          <IconButton
            icon={<IconExternal />}
            label="新しいタブで開く"
            size="sm"
            onClick={openExternal}
          />
        </div>
      </div>
      {props.pending && (
        <div className="visualizerPending" role="status">
          ビジュアライザを更新中...
        </div>
      )}
      <iframe
        ref={props.frameRef}
        className="visualizer"
        src={props.src}
        title="ビジュアライザ"
        onLoad={props.onFrameLoad}
      />
    </div>
  );
}
