import type { ReactNode } from 'react';

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="actionbar">
      <div className="inner">{children}</div>
    </div>
  );
}
