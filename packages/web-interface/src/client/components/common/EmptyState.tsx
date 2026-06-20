import type { ReactNode } from 'react';

type EmptyStateProps = {
  text: string;
  hint?: string;
  icon?: ReactNode;
};

export function EmptyState({ text, hint, icon }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon && <div className="emptyIcon">{icon}</div>}
      <div className="emptyText">{text}</div>
      {hint && <div className="emptyHint">{hint}</div>}
    </div>
  );
}
