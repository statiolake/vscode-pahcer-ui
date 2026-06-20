import { useEffect, useState } from 'react';

import { IconCopy, IconWrap } from '../Tree/icons';

type CodeBlockProps = {
  title?: string;
  subtitle?: string;
  content: string;
  language?: string;
  maxHeight?: number;
  defaultWrap?: boolean;
};

export function CodeBlock({
  title,
  subtitle,
  content,
  language,
  maxHeight,
  defaultWrap = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(defaultWrap);
  const visibleContent = content.length > 0 ? content : '(空)';

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyContent() {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="codeBlock">
      <div className="codeBlockHeader">
        <div className="codeBlockTitle">
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="codeBlockActions">
          <button
            type="button"
            className="codeBlockAction"
            onClick={() => void copyContent()}
            title="内容をコピー"
          >
            <IconCopy />
            <span>{copied ? 'コピー済み' : 'コピー'}</span>
          </button>
          <button
            type="button"
            className="codeBlockAction"
            aria-pressed={wrap}
            onClick={() => setWrap((current) => !current)}
            title="折り返しを切り替え"
          >
            <IconWrap />
            <span>折り返し</span>
          </button>
        </div>
      </div>
      <pre
        className={['codeBlockPre', wrap ? 'wrap' : '', language === 'diff' ? 'diffPre' : '']
          .filter(Boolean)
          .join(' ')}
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {language === 'diff' ? renderDiffContent(visibleContent) : visibleContent}
      </pre>
    </section>
  );
}

function renderDiffContent(content: string) {
  let offset = 0;
  return content.split('\n').map((line) => {
    const key = `${offset}-${line}`;
    offset += line.length + 1;
    return (
      <span className={diffLineClassName(line)} key={key}>
        {line || '\u00a0'}
      </span>
    );
  });
}

function diffLineClassName(line: string): string {
  if (line.startsWith('@@')) {
    return 'diffLine diff-hunk';
  }
  if (line.startsWith('+')) {
    return 'diffLine diff-add';
  }
  if (line.startsWith('-')) {
    return 'diffLine diff-remove';
  }
  return 'diffLine';
}
