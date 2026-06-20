import { type FormEvent, useId, useState } from 'react';

import type { InitializeRequest } from '../../types';
import { Button } from '../common/Button';

type InitializationPanelProps = {
  defaultProjectName: string;
  onInitialize: (request: InitializeRequest) => void;
};

export function InitializationPanel(props: InitializationPanelProps) {
  const problemNameId = useId();
  const problemNameErrorId = useId();
  const objectiveId = useId();
  const languageId = useId();
  const isInteractiveId = useId();
  const testerUrlId = useId();
  const useDetectedInteractiveId = useId();

  const [problemName, setProblemName] = useState(() => props.defaultProjectName);
  const [objective, setObjective] = useState<'max' | 'min'>('max');
  const [language, setLanguage] = useState<'rust' | 'cpp' | 'python' | 'go'>('rust');
  const [isInteractive, setIsInteractive] = useState(false);
  const [testerUrl, setTesterUrl] = useState('');
  const [useDetectedInteractive, setUseDetectedInteractive] = useState(true);
  const [problemNameError, setProblemNameError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedProblemName = problemName.trim();
    if (!trimmedProblemName) {
      setProblemNameError('問題名を入力してください');
      return;
    }

    props.onInitialize({
      problemName: trimmedProblemName,
      objective,
      language,
      isInteractive,
      testerUrl: testerUrl.trim(),
      useDetectedInteractive,
    });
  }

  return (
    <div className="panelContent narrow">
      <h2>Pahcer プロジェクトの初期化</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className={problemNameError ? 'formField fieldInvalid' : 'formField'}>
          <label htmlFor={problemNameId}>問題名</label>
          <input
            id={problemNameId}
            type="text"
            value={problemName}
            placeholder="例: ahc999"
            aria-invalid={Boolean(problemNameError)}
            aria-describedby={problemNameError ? problemNameErrorId : undefined}
            onChange={(event) => {
              setProblemName(event.target.value);
              setProblemNameError(null);
            }}
          />
          <div className="fieldHelp">AtCoderの問題名を入力してください。</div>
          {problemNameError && (
            <div className="fieldError" id={problemNameErrorId}>
              {problemNameError}
            </div>
          )}
        </div>
        <div className="formField">
          <label htmlFor={objectiveId}>最適化の目的</label>
          <select
            id={objectiveId}
            value={objective}
            onChange={(event) => setObjective(event.target.value as 'max' | 'min')}
          >
            <option value="max">スコアを最大化 (Max)</option>
            <option value="min">スコアを最小化 (Min)</option>
          </select>
          <div className="fieldHelp">問題のスコア最適化の方向を選択してください。</div>
        </div>
        <div className="formField">
          <label htmlFor={languageId}>使用言語</label>
          <select
            id={languageId}
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as 'rust' | 'cpp' | 'python' | 'go')
            }
          >
            <option value="rust">Rust</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="go">Go</option>
          </select>
          <div className="fieldHelp">
            プロジェクトで使用するプログラミング言語を選択してください。
          </div>
        </div>
        <div className="formField">
          <div className="checkboxControl">
            <input
              id={isInteractiveId}
              type="checkbox"
              checked={isInteractive}
              onChange={(event) => setIsInteractive(event.target.checked)}
            />
            <label htmlFor={isInteractiveId}>インタラクティブ問題</label>
          </div>
          <div className="fieldHelp">インタラクティブ問題の場合はチェックを入れてください。</div>
        </div>
        <div className="formField">
          <label htmlFor={testerUrlId}>ローカルテスターURL（オプション）</label>
          <input
            id={testerUrlId}
            type="text"
            value={testerUrl}
            placeholder="例: https://img.atcoder.jp/ahc054/YDAxDRZr_v2.zip"
            onChange={(event) => setTesterUrl(event.target.value)}
          />
          <div className="fieldHelp">
            ローカルテスターのZIPファイルURLを入力すると、自動的にダウンロードして展開します。空欄の場合はスキップされます。
          </div>
        </div>
        <div className="formField">
          <div className="checkboxControl">
            <input
              id={useDetectedInteractiveId}
              type="checkbox"
              checked={useDetectedInteractive}
              onChange={(event) => setUseDetectedInteractive(event.target.checked)}
            />
            <label htmlFor={useDetectedInteractiveId}>自動検出したインタラクティブ種別を使う</label>
          </div>
          <div className="fieldHelp">
            {
              'pahcer が自動検出したインタラクティブ種別を使う場合はチェックを入れてください。検出に問題がある場合のみ外してください。'
            }
          </div>
        </div>
        <div className="formActions">
          <Button variant="primary" type="submit">
            初期化
          </Button>
        </div>
      </form>
    </div>
  );
}
