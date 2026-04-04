import type { ReactNode } from 'react';

export function ControlLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '0.73rem', fontWeight: 600, marginBottom: '0.25rem', opacity: 0.78, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  );
}

export function FieldShell({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: '0.85rem' }}>{children}</div>;
}
