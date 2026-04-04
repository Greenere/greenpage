import type { CSSProperties } from 'react';

import { normalizeNodeContent, type GraphNodeContent } from '../graph/content/Nodes';

// ── styles ──

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.72rem',
  borderRadius: '10px',
  border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
  background: 'transparent',
  color: 'var(--color-text)',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  fontSize: '0.8rem',
  lineHeight: 1.6,
  resize: 'vertical',
};

// ── helpers ──

/**
 * Parse JSON, tolerating trailing commas before `}` / `]` (common while mid-typing).
 */
function lenientParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
  }
}

// ── component ──

type JsonEditorPanelProps = {
  label?: string;
  hint?: string;
  text: string;
  nodeId: string;
  jsonError: string | null;
  onChangeText: (value: string, parsedContent: GraphNodeContent | null, error: string | null) => void;
};

export default function JsonEditorPanel({
  label,
  hint,
  text,
  nodeId,
  jsonError,
  onChangeText,
}: JsonEditorPanelProps) {
  const handleChange = (value: string) => {
    try {
      const parsed = lenientParse(value);
      const normalized = normalizeNodeContent(parsed, nodeId);
      onChangeText(value, normalized, null);
    } catch (error) {
      onChangeText(value, null, error instanceof Error ? error.message : 'Invalid JSON.');
    }
  };

  return (
    <>
      {label && (
        <div style={{ fontSize: '0.73rem', fontWeight: 600, marginBottom: '0.35rem', opacity: 0.78, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
      )}
      {hint && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.62, lineHeight: 1.55 }}>
          {hint}
        </div>
      )}
      <textarea
        value={text}
        rows={30}
        style={textareaStyle}
        onChange={(event) => handleChange(event.target.value)}
      />
      {jsonError && (
        <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>
          {jsonError}
        </div>
      )}
    </>
  );
}
