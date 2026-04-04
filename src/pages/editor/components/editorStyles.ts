import type { CSSProperties } from 'react';

export function inputStyle(multiline = false): CSSProperties {
  return {
    width: '100%',
    padding: '0.6rem 0.72rem',
    borderRadius: '10px',
    border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
    background: 'transparent',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    resize: multiline ? 'vertical' : undefined,
  };
}

export const btnPrimary: CSSProperties = {
  padding: '0.48rem 0.9rem',
  borderRadius: '10px',
  fontSize: '0.83rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid transparent',
  background: 'var(--color-text)',
  color: 'var(--color-background)',
};

export const btnSecondary: CSSProperties = {
  padding: '0.48rem 0.9rem',
  borderRadius: '10px',
  fontSize: '0.83rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
  background: 'transparent',
  color: 'var(--color-text)',
};

export const btnDanger: CSSProperties = {
  ...btnSecondary,
  border: '1px solid color-mix(in srgb, crimson 28%, transparent)',
  color: 'color-mix(in srgb, crimson 70%, var(--color-text))',
};

export const btnDisabled: CSSProperties = { opacity: 0.38, cursor: 'not-allowed' };
