import { type FormEvent, useId, useState } from 'react';

import type { RunOptions } from '../../types';
import { Button } from '../common/Button';

const DEFAULT_START_SEED = 0;
const DEFAULT_END_SEED = 100;

type RunOptionsPanelProps = {
  onRun: (options: RunOptions) => void;
  onCancel: () => void;
};

type SeedInputParseResult =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'number'; value: number };

type NormalizedSeedRange = {
  startSeed: number | undefined;
  endSeed: number | undefined;
};

export function RunOptionsPanel(props: RunOptionsPanelProps) {
  const startSeedId = useId();
  const endSeedId = useId();
  const freezeBestScoresId = useId();
  const enableGitIntegrationId = useId();

  const [startSeedInput, setStartSeedInput] = useState(String(DEFAULT_START_SEED));
  const [endSeedInput, setEndSeedInput] = useState(String(DEFAULT_END_SEED));
  const [freezeBestScores, setFreezeBestScores] = useState(false);
  const [enableGitIntegration, setEnableGitIntegration] = useState(false);

  const startSeedParseResult = parseSeedInput(startSeedInput);
  const endSeedParseResult = parseSeedInput(endSeedInput);
  const effectiveStartSeed = effectiveSeedValue(
    correctedSeedValue(startSeedParseResult, DEFAULT_START_SEED),
    DEFAULT_START_SEED,
  );
  const endSeedMin = effectiveStartSeed + 1;
  const canSubmit =
    startSeedParseResult.kind !== 'invalid' && endSeedParseResult.kind !== 'invalid';

  function handleStartSeedBlur() {
    const normalizedRange = normalizeSeedRange(startSeedInput, endSeedInput);
    setStartSeedInput(formatSeedInput(normalizedRange.startSeed));
    setEndSeedInput(formatSeedInput(normalizedRange.endSeed));
  }

  function handleEndSeedBlur() {
    const normalizedRange = normalizeSeedRange(startSeedInput, endSeedInput);
    setEndSeedInput(formatSeedInput(normalizedRange.endSeed));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const normalizedRange = normalizeSeedRange(startSeedInput, endSeedInput);
    setStartSeedInput(formatSeedInput(normalizedRange.startSeed));
    setEndSeedInput(formatSeedInput(normalizedRange.endSeed));

    props.onRun({
      startSeed: defaultSeedValue(normalizedRange.startSeed, DEFAULT_START_SEED),
      endSeed: defaultSeedValue(normalizedRange.endSeed, DEFAULT_END_SEED),
      freezeBestScores,
      enableGitIntegration,
    });
  }

  return (
    <div className="panelContent narrow">
      <p className="formIntro">実行範囲やオプションを指定してテストを実行します。</p>
      <form className="form" noValidate onSubmit={handleSubmit}>
        <div className="formField">
          <label htmlFor={startSeedId}>開始 Seed</label>
          <input
            id={startSeedId}
            type="number"
            min={DEFAULT_START_SEED}
            step={1}
            value={startSeedInput}
            aria-invalid={startSeedParseResult.kind === 'invalid'}
            onBlur={handleStartSeedBlur}
            onChange={(event) => setStartSeedInput(event.target.value)}
          />
          <div className="fieldHelp">テストケースの開始seed値を指定します。</div>
        </div>
        <div className="formField">
          <label htmlFor={endSeedId}>終了 Seed</label>
          <input
            id={endSeedId}
            type="number"
            min={endSeedMin}
            step={1}
            value={endSeedInput}
            aria-invalid={endSeedParseResult.kind === 'invalid'}
            onBlur={handleEndSeedBlur}
            onChange={(event) => setEndSeedInput(event.target.value)}
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
          <Button variant="primary" type="submit" disabled={!canSubmit}>
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

function parseSeedInput(value: string): SeedInputParseResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { kind: 'empty' };
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isFinite(parsedValue)) {
    return { kind: 'invalid' };
  }

  return { kind: 'number', value: parsedValue };
}

function normalizeSeedRange(startSeedInput: string, endSeedInput: string): NormalizedSeedRange {
  const startSeed = correctedSeedValue(parseSeedInput(startSeedInput), DEFAULT_START_SEED);
  const effectiveStartSeed = effectiveSeedValue(startSeed, DEFAULT_START_SEED);
  const endSeedMin = effectiveStartSeed + 1;
  const endSeed = correctedSeedValue(parseSeedInput(endSeedInput), endSeedMin);

  return {
    startSeed,
    endSeed: effectiveSeedValue(endSeed, DEFAULT_END_SEED) < endSeedMin ? endSeedMin : endSeed,
  };
}

function correctedSeedValue(parseResult: SeedInputParseResult, min: number): number | undefined {
  if (parseResult.kind !== 'number') {
    return undefined;
  }

  return Math.max(parseResult.value, min);
}

function effectiveSeedValue(value: number | undefined, defaultValue: number): number {
  return value ?? defaultValue;
}

function formatSeedInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function defaultSeedValue(value: number | undefined, defaultValue: number): number | undefined {
  return value === undefined || value === defaultValue ? undefined : value;
}
