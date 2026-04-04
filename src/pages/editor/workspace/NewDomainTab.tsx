import type { Dispatch } from 'react';
import { UI_COPY } from '../../../configs/ui/uiCopy';
import type { NewDomainDraft, NodeEditorWorkspaceAction } from '../nodeEditorState';
import { ControlLabel, FieldShell } from '../components/ControlLabel';
import { btnPrimary, btnDisabled, inputStyle } from '../components/editorStyles';

type NewDomainTabProps = {
  newDomainDraft: NewDomainDraft;
  newDomainIdAlreadyExists: boolean;
  newDomainIdInvalid: boolean;
  newDomainCardTagAlreadyExists: boolean;
  newDomainCreateDisabled: boolean;
  dispatch: Dispatch<NodeEditorWorkspaceAction>;
  onCreateDomain: () => void;
};

export function NewDomainTab({
  newDomainDraft,
  newDomainIdAlreadyExists,
  newDomainIdInvalid,
  newDomainCardTagAlreadyExists,
  newDomainCreateDisabled,
  dispatch,
  onCreateDomain,
}: NewDomainTabProps) {
  return (
    <div style={{ marginTop: '0.85rem' }}>
      <div
        style={{
          padding: '0.8rem 0.9rem',
          borderRadius: '12px',
          background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          opacity: 0.82,
        }}
      >
        <div><strong>{UI_COPY.nodeEditor.newDomainTab.infoDomainId}</strong> {UI_COPY.nodeEditor.newDomainTab.infoDomainIdDescription}</div>
        <div><strong>{UI_COPY.nodeEditor.newDomainTab.infoDisplay}</strong> {UI_COPY.nodeEditor.newDomainTab.infoDisplayDescription}</div>
        <div><strong>{UI_COPY.nodeEditor.newDomainTab.infoCardTag}</strong> {UI_COPY.nodeEditor.newDomainTab.infoCardTagDescription}</div>
        <div><strong>{UI_COPY.nodeEditor.newDomainTab.infoSeedAngle}</strong> {UI_COPY.nodeEditor.newDomainTab.infoSeedAngleDescription}</div>
      </div>
      <FieldShell>
        <div style={{ position: 'relative' }}>
          <ControlLabel>{UI_COPY.nodeEditor.newDomainTab.domainId}</ControlLabel>
          {newDomainIdAlreadyExists ? (
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
              {UI_COPY.nodeEditor.newDomainTab.domainIdExists}
            </div>
          ) : null}
        </div>
        <input
          value={newDomainDraft.domainId}
          onChange={(event) =>
            dispatch({ type: 'merge_new_domain_draft', patch: { domainId: event.target.value } })
          }
          style={inputStyle()}
        />
        {!newDomainIdAlreadyExists && newDomainIdInvalid ? (
          <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
            {UI_COPY.nodeEditor.newDomainTab.domainIdInvalid}
          </div>
        ) : null}
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newDomainTab.displayLabel}</ControlLabel>
        <input
          value={newDomainDraft.display}
          onChange={(event) =>
            dispatch({ type: 'merge_new_domain_draft', patch: { display: event.target.value } })
          }
          style={inputStyle()}
        />
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newDomainTab.cardTag}</ControlLabel>
        <input
          value={newDomainDraft.cardTag}
          onChange={(event) =>
            dispatch({ type: 'merge_new_domain_draft', patch: { cardTag: event.target.value } })
          }
          style={inputStyle()}
        />
        {newDomainCardTagAlreadyExists ? (
          <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
            {UI_COPY.nodeEditor.newDomainTab.cardTagExists}
          </div>
        ) : (
          <div style={{ marginTop: '0.45rem', color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>
            {UI_COPY.nodeEditor.newDomainTab.cardTagHint}
          </div>
        )}
      </FieldShell>
      <FieldShell>
        <ControlLabel>{UI_COPY.nodeEditor.newDomainTab.seedAngle}</ControlLabel>
        <input
          type="number"
          value={newDomainDraft.seedAngle}
          onChange={(event) =>
            dispatch({
              type: 'merge_new_domain_draft',
              patch: { seedAngle: Number(event.target.value) },
            })
          }
          style={inputStyle()}
        />
      </FieldShell>
      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={onCreateDomain}
          disabled={newDomainCreateDisabled}
          style={newDomainCreateDisabled ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
        >
          {UI_COPY.nodeEditor.newDomainTab.createDomain}
        </button>
      </div>
    </div>
  );
}
