import type {
  TreeExecutionCases,
  TreeExecutionStats,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import { type FormEvent, useState } from 'react';

import { executionDescription, executionTreeLabel } from '../../utils/format';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { IconButton } from '../common/IconButton';
import { Modal } from '../common/Modal';
import { CaseRow } from './CaseRow';
import { IconCheck, IconCopy, IconCross, IconGitCommit, IconPencil, IconWarning } from './icons';
import { SummaryRow } from './SummaryRow';

type ExecutionTreeProps = {
  stats: TreeExecutionStats[];
  openExecutionId: string | null;
  cases: TreeExecutionCases | null;
  selectedExecutionIds: string[];
  onToggleExecution: (executionId: string) => void;
  onOpenExecution: (executionId: string) => void;
  onSelectCase: (executionId: string, seed: number) => void;
  onSaveComment: (executionId: string, comment: string) => void;
  onPrepareSource: (executionId: string) => void;
};

type EditingExecution = {
  id: string;
  shortTitle: string;
  comment: string;
};

type CommitGraphConnections = {
  connectsPrevious: boolean;
  connectsNext: boolean;
};

export function ExecutionTree(props: ExecutionTreeProps) {
  const [editingExecution, setEditingExecution] = useState<EditingExecution | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  if (props.stats.length === 0) {
    return <EmptyState text="実行結果がありません" />;
  }

  function openCommentEditor(stats: TreeExecutionStats) {
    setEditingExecution({
      id: stats.execution.id,
      shortTitle: stats.execution.shortTitle,
      comment: stats.execution.comment,
    });
    setCommentDraft(stats.execution.comment);
  }

  function closeCommentEditor() {
    setEditingExecution(null);
    setCommentDraft('');
  }

  function saveComment(event: FormEvent) {
    event.preventDefault();

    if (!editingExecution) {
      return;
    }

    if (commentDraft !== editingExecution.comment) {
      props.onSaveComment(editingExecution.id, commentDraft);
    }
    closeCommentEditor();
  }

  return (
    <>
      <ul className="tree" aria-label="実行結果">
        {props.stats.map((stats, index) => {
          const description = executionDescription(stats.execution);
          const isOpen = props.openExecutionId === stats.execution.id;
          const rowLabel = executionTreeLabel(stats);
          const hasCommitHash = Boolean(stats.execution.commitHash);
          const commitGraphConnections = {
            connectsPrevious:
              hasCommitHash && Boolean(props.stats[index - 1]?.execution.commitHash),
            connectsNext: hasCommitHash && Boolean(props.stats[index + 1]?.execution.commitHash),
          };

          return (
            <li className="treeGroup" key={stats.execution.id} aria-label={rowLabel}>
              <div className="treeRow executionRow">
                <button
                  type="button"
                  className="disclosure"
                  onClick={() => props.onOpenExecution(stats.execution.id)}
                  aria-label={`${rowLabel} を${isOpen ? '閉じる' : '開く'}`}
                  aria-expanded={isOpen}
                >
                  {isOpen ? '▼' : '▶'}
                </button>
                <input
                  type="checkbox"
                  className="treeCheckbox"
                  checked={props.selectedExecutionIds.includes(stats.execution.id)}
                  onChange={() => props.onToggleExecution(stats.execution.id)}
                  aria-label={`${stats.execution.shortTitle} を比較対象にする`}
                />
                {executionIcon(stats, commitGraphConnections)}
                <button
                  type="button"
                  className="treeLabel"
                  onClick={() => props.onOpenExecution(stats.execution.id)}
                  aria-label={rowLabel}
                  aria-expanded={isOpen}
                >
                  {rowLabel}
                </button>
                {description && (
                  <span className="description" title={description}>
                    {description}
                  </span>
                )}
                <span className="rowActions">
                  <IconButton
                    icon={<IconPencil />}
                    label="コメントを編集"
                    size="sm"
                    variant="ghost"
                    onClick={() => openCommentEditor(stats)}
                  />
                  <IconButton
                    icon={<IconCopy />}
                    label="この時点のソースをコピー"
                    size="sm"
                    variant="ghost"
                    onClick={() => props.onPrepareSource(stats.execution.id)}
                  />
                </span>
              </div>
              {isOpen && props.cases && (
                <ul className="children" aria-label={`${rowLabel} のケース`}>
                  <SummaryRow stats={props.cases.executionStats} />
                  {props.cases.cases.map(({ testCase, relativeScore }) => (
                    <CaseRow
                      key={`${testCase.executionId}:${testCase.seed}`}
                      testCase={testCase}
                      relativeScore={relativeScore}
                      onSelect={() => props.onSelectCase(testCase.executionId, testCase.seed)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <Modal
        open={Boolean(editingExecution)}
        onClose={closeCommentEditor}
        title={editingExecution ? `${editingExecution.shortTitle} のコメント` : 'コメント'}
        footer={
          <>
            <Button onClick={closeCommentEditor}>キャンセル</Button>
            <Button variant="primary" type="submit" form="commentForm">
              保存
            </Button>
          </>
        }
      >
        <form id="commentForm" onSubmit={saveComment}>
          <label>
            コメント
            <textarea
              value={commentDraft}
              rows={4}
              onChange={(event) => setCommentDraft(event.target.value)}
            />
          </label>
        </form>
      </Modal>
    </>
  );
}

function executionIcon(stats: TreeExecutionStats, commitGraphConnections: CommitGraphConnections) {
  const color = stats.waSeeds.length === 0 ? 'success' : stats.acCount > 0 ? 'warning' : 'danger';

  if (stats.execution.commitHash) {
    return (
      <span
        className={[
          'executionStatusIcon',
          'commitGraphIcon',
          commitGraphConnections.connectsPrevious ? 'connectsPrevious' : '',
          commitGraphConnections.connectsNext ? 'connectsNext' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <IconGitCommit color={color} />
      </span>
    );
  }

  if (stats.waSeeds.length === 0) {
    return (
      <span className="executionStatusIcon">
        <IconCheck color="success" />
      </span>
    );
  }

  if (stats.acCount > 0) {
    return (
      <span className="executionStatusIcon">
        <IconWarning color="warning" />
      </span>
    );
  }

  return (
    <span className="executionStatusIcon">
      <IconCross color="danger" />
    </span>
  );
}
