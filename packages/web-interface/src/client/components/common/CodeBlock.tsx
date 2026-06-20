import { useEffect, useState } from 'react';
import { IconCheck, IconCopy, IconWrap } from '../Tree/icons';
import { IconButton } from './IconButton';

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
  const copyLabel = copied ? 'コピー済み' : 'クリップボードにコピー';
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
        {title ? <h3 className="codeBlockTitle">{title}</h3> : <span className="codeBlockTitle" />}
        <div className="codeBlockActions">
          <IconButton
            icon={copied ? <IconCheck color="success" /> : <IconCopy />}
            label={copyLabel}
            size="sm"
            variant="ghost"
            active={copied}
            onClick={() => void copyContent()}
          />
          <IconButton
            icon={<IconWrap />}
            label="折り返しを切替"
            size="sm"
            variant="ghost"
            active={wrap}
            onClick={() => setWrap((current) => !current)}
          />
        </div>
      </div>
      {subtitle && (
        <div className="codeBlockSubtitle" title={subtitle}>
          {subtitle}
        </div>
      )}
      <pre
        className={[wrap ? 'wrap' : '', language === 'diff' ? 'diffPre' : '']
          .filter(Boolean)
          .join(' ')}
        style={maxHeight ? { maxHeight } : undefined}
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
