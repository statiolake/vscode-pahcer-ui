import type {
  TreeExecutionCases,
  TreeExecutionStats,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import { type FormEvent, useState } from 'react';

import { executionDescription, executionTreeLabel } from '../../utils/format';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
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
    <div className="tree">
      {props.stats.map((stats) => {
        const description = executionDescription(stats.execution);
        const isOpen = props.openExecutionId === stats.execution.id;

        return (
          <div className="treeGroup" key={stats.execution.id}>
            <div className="treeRow executionRow">
              <button
                type="button"
                className="disclosure"
                onClick={() => props.onOpenExecution(stats.execution.id)}
                aria-label={isOpen ? '閉じる' : '開く'}
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
              {executionIcon(stats)}
              <button
                type="button"
                className="treeLabel"
                onClick={() => props.onOpenExecution(stats.execution.id)}
              >
                {executionTreeLabel(stats)}
              </button>
              {description && (
                <span className="description" title={description}>
                  {description}
                </span>
              )}
              <span className="rowActions">
                <button
                  type="button"
                  aria-label={`${stats.execution.shortTitle} のコメントを編集`}
                  title="コメント"
                  onClick={() => openCommentEditor(stats)}
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  aria-label={`${stats.execution.shortTitle} のソースを準備`}
                  title="ソース"
                  onClick={() => props.onPrepareSource(stats.execution.id)}
                >
                  <IconCopy />
                </button>
              </span>
            </div>
            {isOpen && props.cases && (
              <div className="children">
                <SummaryRow stats={props.cases.executionStats} />
                {props.cases.cases.map(({ testCase, relativeScore }) => (
                  <CaseRow
                    key={`${testCase.executionId}:${testCase.seed}`}
                    testCase={testCase}
                    relativeScore={relativeScore}
                    onSelect={() => props.onSelectCase(testCase.executionId, testCase.seed)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
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
    </div>
  );
}

function executionIcon(stats: TreeExecutionStats) {
  const color = stats.waSeeds.length === 0 ? 'success' : stats.acCount > 0 ? 'warning' : 'danger';

  if (stats.execution.commitHash) {
    return <IconGitCommit color={color} />;
  }

  if (stats.waSeeds.length === 0) {
    return <IconCheck color="success" />;
  }

  if (stats.acCount > 0) {
    return <IconWarning color="warning" />;
  }

  return <IconCross color="danger" />;
}
