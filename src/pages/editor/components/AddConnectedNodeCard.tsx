import { useState } from 'react';
import { UI_COPY } from '../../../configs/ui/uiCopy';

export function AddConnectedNodeCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '0.8rem 0.85rem',
        borderRadius: '16px',
        border: '1px dashed color-mix(in srgb, var(--color-secondary) 38%, transparent)',
        background: hovered ? 'color-mix(in srgb, var(--color-background) 80%, white 20%)' : 'transparent',
        color: 'var(--color-text)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: hovered
          ? 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-active, 3) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-active, 0.9) * 100%), transparent)'
          : 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-idle, 0) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-idle, 0.8) * 100%), transparent)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'box-shadow 180ms ease, background-color 180ms ease, transform 180ms ease',
      }}
      title={UI_COPY.nodeEditor.connectedNodes.addExplicitConnection}
    >
      <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>+</div>
      <div style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
        {UI_COPY.nodeEditor.connectedNodes.addExplicitConnection}
      </div>
      <div style={{ marginTop: '0.38rem', fontSize: '0.76rem', lineHeight: 1.45, opacity: 0.8 }}>
        {UI_COPY.nodeEditor.connectedNodes.addExplicitConnectionHint}
      </div>
    </button>
  );
}
