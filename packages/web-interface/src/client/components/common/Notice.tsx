import type { ReactNode } from 'react';

type NoticeProps = {
  tone?: 'default' | 'error';
  children: ReactNode;
};

export function Notice({ tone = 'default', children }: NoticeProps) {
  return <div className={tone === 'error' ? 'notice error' : 'notice'}>{children}</div>;
}
