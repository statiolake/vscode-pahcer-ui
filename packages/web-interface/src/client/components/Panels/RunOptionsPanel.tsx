import { type FormEvent, useId, useState } from 'react';

import type { RunOptions } from '../../types';
import { Button } from '../common/Button';

const MIN_SEED = 0;
const USE_CONFIG_PLACEHOLDER = '(設定値を使う)';

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

  const [startSeedInput, setStartSeedInput] = useState('');
  const [endSeedInput, setEndSeedInput] = useState('');
  const [freezeBestScores, setFreezeBestScores] = useState(false);
  const [enableGitIntegration, setEnableGitIntegration] = useState(false);

  const startSeedParseResult = parseSeedInput(startSeedInput);
  const endSeedParseResult = parseSeedInput(endSeedInput);
  const endSeedMin =
    startSeedParseResult.kind === 'number' && startSeedParseResult.value >= MIN_SEED
      ? startSeedParseResult.value + 1
      : MIN_SEED;
  const startSeedInvalid = isInvalidStartSeed(startSeedParseResult);
  const endSeedInvalid = isInvalidEndSeed(startSeedParseResult, endSeedParseResult);
  const canSubmit = !startSeedInvalid && !endSeedInvalid;

  function handleStartSeedBlur() {
    setStartSeedInput(formatSeedInput(startSeedParseResult));
  }

  function handleEndSeedBlur() {
    setEndSeedInput(formatSeedInput(endSeedParseResult));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const normalizedRange = normalizeSeedRange(startSeedInput, endSeedInput);
    setStartSeedInput(formatSeedValue(normalizedRange.startSeed));
    setEndSeedInput(formatSeedValue(normalizedRange.endSeed));

    props.onRun({
      startSeed: normalizedRange.startSeed,
      endSeed: normalizedRange.endSeed,
      freezeBestScores,
      enableGitIntegration,
    });
  }

  return (
    <div className="runOptionsPanel">
      <p className="formIntro">実行範囲やオプションを指定してテストを実行します。</p>
      <form className="form" noValidate onSubmit={handleSubmit}>
        <div className="formField">
          <label htmlFor={startSeedId}>開始 Seed</label>
          <input
            id={startSeedId}
            type="number"
            min={MIN_SEED}
            placeholder={USE_CONFIG_PLACEHOLDER}
            step={1}
            value={startSeedInput}
            aria-invalid={startSeedInvalid}
            onBlur={handleStartSeedBlur}
            onChange={(event) => setStartSeedInput(event.target.value)}
          />
          <div className="fieldHelp">
            テストケースの開始seed値を指定します。空欄なら pahcer config の start_seed を使います。
          </div>
        </div>
        <div className="formField">
          <label htmlFor={endSeedId}>終了 Seed</label>
          <input
            id={endSeedId}
            type="number"
            min={endSeedMin}
            placeholder={USE_CONFIG_PLACEHOLDER}
            step={1}
            value={endSeedInput}
            aria-invalid={endSeedInvalid}
            onBlur={handleEndSeedBlur}
            onChange={(event) => setEndSeedInput(event.target.value)}
          />
          <div className="fieldHelp">
            テストケースの終了seed値を指定します。[start_seed, end_seed)
            の半開区間が実行されるため、end_seedは区間に含まれません。空欄なら pahcer config の
            end_seed を使います。
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
  return {
    startSeed: parsedSeedValue(parseSeedInput(startSeedInput)),
    endSeed: parsedSeedValue(parseSeedInput(endSeedInput)),
  };
}

function isInvalidStartSeed(parseResult: SeedInputParseResult): boolean {
  return parseResult.kind === 'invalid' || isNegativeSeed(parseResult);
}

function isInvalidEndSeed(
  startSeedParseResult: SeedInputParseResult,
  endSeedParseResult: SeedInputParseResult,
): boolean {
  if (endSeedParseResult.kind === 'invalid' || isNegativeSeed(endSeedParseResult)) {
    return true;
  }

  if (startSeedParseResult.kind !== 'number' || endSeedParseResult.kind !== 'number') {
    return false;
  }

  return endSeedParseResult.value <= startSeedParseResult.value;
}

function isNegativeSeed(parseResult: SeedInputParseResult): boolean {
  return parseResult.kind === 'number' && parseResult.value < MIN_SEED;
}

function parsedSeedValue(parseResult: SeedInputParseResult): number | undefined {
  return parseResult.kind === 'number' ? parseResult.value : undefined;
}

function formatSeedInput(parseResult: SeedInputParseResult): string {
  return formatSeedValue(parsedSeedValue(parseResult));
}

function formatSeedValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}
