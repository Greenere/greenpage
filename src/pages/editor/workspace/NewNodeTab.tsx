import type { Dispatch } from 'react';
import { DOMAIN_ORDER } from '../../../configs/content/domains';
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { CHRONOLOGY_FORMAT_HINT } from '../../../shared/chronology';
import { getDisplayDomain, type GraphNodeRef } from '../../graph/content/Nodes';
import type { NewNodeDraft } from '../editorApi';
import type { NodeEditorWorkspaceAction } from '../nodeEditorState';
import { getDefaultKindForDomain } from '../templates';
import { ControlLabel, FieldShell } from '../components/ControlLabel';
import { btnPrimary, btnDisabled, inputStyle } from '../components/editorStyles';

type NodeTemplateOption = { id: string; label: string };

type NewNodeTabProps = {
  newNodeDraft: NewNodeDraft;
  newNodeIdAlreadyExists: boolean;
  newNodeIdInvalid: boolean;
  newNodeChronologyError: string | null;
  newNodeCreateDisabled: boolean;
  nodeTemplateOptions: NodeTemplateOption[];
  dispatch: Dispatch<NodeEditorWorkspaceAction>;
  onCreateNode: () => void;
};

export function NewNodeTab({
  newNodeDraft,
  newNodeIdAlreadyExists,
  newNodeIdInvalid,
  newNodeChronologyError,
  newNodeCreateDisabled,
  nodeTemplateOptions,
  dispatch,
  onCreateNode,
}: NewNodeTabProps) {
  return (
    <div style={{ marginTop: '0.85rem' }}>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.domain}</ControlLabel>
        <select
          value={newNodeDraft.domain}
          onChange={(event) => {
            const domain = event.target.value as (typeof DOMAIN_ORDER)[number];
            dispatch({
              type: 'merge_new_node_draft',
              patch: {
                domain,
                kind: getDefaultKindForDomain(domain),
              },
            });
          }}
          style={inputStyle()}
        >
          {DOMAIN_ORDER.map((domain) => (
            <option key={domain} value={domain}>
              {getDisplayDomain(domain)}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldShell>
        <div style={{ position: 'relative' }}>
          <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.nodeId}</ControlLabel>
          {newNodeIdAlreadyExists ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                color: 'crimson',
                fontSize: '0.8rem',
                lineHeight: 1,
                textTransform: 'none',
                letterSpacing: 'normal',
              }}
            >
              {UI_COPY.nodeEditor.newNodeTab.nodeIdExists}
            </div>
          ) : null}
        </div>
        <input
          value={newNodeDraft.nodeId}
          onChange={(event) =>
            dispatch({ type: 'merge_new_node_draft', patch: { nodeId: event.target.value } })
          }
          placeholder={UI_COPY.nodeEditor.newNodeTab.nodeIdPlaceholder}
          style={inputStyle()}
        />
        {!newNodeIdAlreadyExists && newNodeIdInvalid ? (
          <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
            {UI_COPY.nodeEditor.newNodeTab.nodeIdInvalid}
          </div>
        ) : null}
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.template}</ControlLabel>
        <select
          value={newNodeDraft.template}
          onChange={(event) =>
            dispatch({ type: 'merge_new_node_draft', patch: { template: event.target.value } })
          }
          style={inputStyle()}
        >
          {nodeTemplateOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ marginTop: '0.45rem', color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>
          {UI_COPY.nodeEditor.newNodeTab.templatePreviewHint}
        </div>
      </FieldShell>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.85rem' }}>
        <div>
          <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.kind}</ControlLabel>
          <input
            value={newNodeDraft.kind}
            onChange={(event) =>
              dispatch({
                type: 'merge_new_node_draft',
                patch: { kind: event.target.value as GraphNodeRef['kind'] },
              })
            }
            style={{ ...inputStyle(), padding: '0.48rem 0.58rem', fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.chronology}</ControlLabel>
          <input
            type="text"
            inputMode="numeric"
            value={newNodeDraft.chronology}
            onChange={(event) =>
              dispatch({
                type: 'merge_new_node_draft',
                patch: { chronology: event.target.value },
              })
            }
            placeholder={CHRONOLOGY_FORMAT_HINT}
            style={{ ...inputStyle(), padding: '0.48rem 0.58rem', fontSize: '0.82rem' }}
          />
          <div
            style={{
              marginTop: '0.35rem',
              fontSize: '0.74rem',
              color: newNodeChronologyError ? 'crimson' : 'var(--color-text-subtle)',
              lineHeight: 1.45,
            }}
          >
            {newNodeChronologyError ?? CHRONOLOGY_FORMAT_HINT}
          </div>
        </div>
      </div>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.title}</ControlLabel>
        <input
          value={newNodeDraft.title}
          onChange={(event) =>
            dispatch({ type: 'merge_new_node_draft', patch: { title: event.target.value } })
          }
          style={inputStyle()}
        />
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.subtitle}</ControlLabel>
        <input
          value={newNodeDraft.subtitle}
          onChange={(event) =>
            dispatch({ type: 'merge_new_node_draft', patch: { subtitle: event.target.value } })
          }
          style={inputStyle()}
        />
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newNodeTab.summary}</ControlLabel>
        <textarea
          value={newNodeDraft.summary}
          onChange={(event) =>
            dispatch({ type: 'merge_new_node_draft', patch: { summary: event.target.value } })
          }
          rows={3}
          style={inputStyle(true)}
        />
      </FieldShell>
      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={onCreateNode}
          disabled={newNodeCreateDisabled}
          style={newNodeCreateDisabled ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
        >
          {UI_COPY.nodeEditor.newNodeTab.createNode}
        </button>
      </div>
    </div>
  );
}
