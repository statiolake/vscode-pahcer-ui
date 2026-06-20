import { type FormEvent, useId, useState } from 'react';

import type { RunOptions } from '../../types';
import { Button } from '../common/Button';

type RunOptionsPanelProps = {
  onRun: (options: RunOptions) => void;
  onCancel: () => void;
};

export function RunOptionsPanel(props: RunOptionsPanelProps) {
  const startSeedId = useId();
  const endSeedId = useId();
  const freezeBestScoresId = useId();
  const enableGitIntegrationId = useId();

  const [startSeed, setStartSeed] = useState(0);
  const [endSeed, setEndSeed] = useState(100);
  const [freezeBestScores, setFreezeBestScores] = useState(false);
  const [enableGitIntegration, setEnableGitIntegration] = useState(false);

  function handleStartSeedChange(value: string) {
    const nextStartSeed = parseSeedInput(value, startSeed, 0);
    setStartSeed(nextStartSeed);
    setEndSeed((current) => Math.max(current, nextStartSeed + 1));
  }

  function handleEndSeedChange(value: string) {
    setEndSeed(parseSeedInput(value, endSeed, startSeed + 1));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onRun({
      startSeed: defaultSeedValue(startSeed, 0),
      endSeed: defaultSeedValue(endSeed, 100),
      freezeBestScores,
      enableGitIntegration,
    });
  }

  return (
    <div className="panelContent narrow">
      <h2>詳細実行オプション</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="formField">
          <label htmlFor={startSeedId}>開始 Seed</label>
          <input
            id={startSeedId}
            type="number"
            min={0}
            step={1}
            value={startSeed}
            onChange={(event) => handleStartSeedChange(event.target.value)}
          />
          <div className="fieldHelp">テストケースの開始seed値を指定します。</div>
        </div>
        <div className="formField">
          <label htmlFor={endSeedId}>終了 Seed</label>
          <input
            id={endSeedId}
            type="number"
            min={startSeed + 1}
            step={1}
            value={endSeed}
            onChange={(event) => handleEndSeedChange(event.target.value)}
          />
          <div className="fieldHelp">
            テストケースの終了seed値を指定します。[start_seed, end_seed)
            の半開区間が実行されるため、end_seedは区間に含まれません。
          </div>
        </div>
        <div className="formField">
          <div className="checkboxControl">
            <input
              id={freezeBestScoresId}
              type="checkbox"
              checked={freezeBestScores}
              onChange={(event) => setFreezeBestScores(event.target.checked)}
            />
            <label htmlFor={freezeBestScoresId}>
              ベストスコアを更新しない (--freeze-best-scores)
            </label>
          </div>
          <div className="fieldHelp">
            チェックすると、ベストスコアの更新を行わずにテストを実行します。
          </div>
        </div>
        <div className="formField">
          <div className="checkboxControl">
            <input
              id={enableGitIntegrationId}
              type="checkbox"
              checked={enableGitIntegration}
              onChange={(event) => setEnableGitIntegration(event.target.checked)}
            />
            <label htmlFor={enableGitIntegrationId}>Git 連携を使う</label>
          </div>
          <div className="fieldHelp">
            実行前後で結果と差分をコミットして比較できるようにします。
          </div>
        </div>
        <div className="formActions">
          <Button variant="primary" type="submit">
            実行
          </Button>
          <Button variant="secondary" onClick={props.onCancel}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}

function parseSeedInput(value: string, fallback: number, min: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, min) : fallback;
}

function defaultSeedValue(value: number, defaultValue: number): number | undefined {
  return value === defaultValue ? undefined : value;
}
