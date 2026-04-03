import type { CSSProperties } from 'react';

import { UI_COPY } from '../../configs/uiCopy';
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

const btnPrimary: CSSProperties = {
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

const btnSecondary: CSSProperties = {
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

const btnDisabled: CSSProperties = { opacity: 0.38, cursor: 'not-allowed' };

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
  text: string;
  nodeId: string;
  jsonError: string | null;
  validationError: string | null;
  actionPending: boolean;
  onChangeText: (value: string, parsedContent: GraphNodeContent | null, error: string | null) => void;
  onWriteToFile: () => void;
  onSaveDraft: () => void;
};

export default function JsonEditorPanel({
  text,
  nodeId,
  jsonError,
  validationError,
  actionPending,
  onChangeText,
  onWriteToFile,
  onSaveDraft,
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

  const displayError = jsonError ?? validationError;
  const canWrite = !displayError && !actionPending;

  return (
    <>
      <textarea
        value={text}
        rows={30}
        style={textareaStyle}
        onChange={(event) => handleChange(event.target.value)}
      />
      {displayError && (
        <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>
          {displayError}
        </div>
      )}
      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onWriteToFile}
          disabled={!canWrite}
          style={canWrite ? btnPrimary : { ...btnPrimary, ...btnDisabled }}
        >
          {UI_COPY.nodeEditor.jsonTab.writeToFile}
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          style={btnSecondary}
        >
          {UI_COPY.nodeEditor.jsonTab.saveDraft}
        </button>
      </div>
    </>
  );
}
