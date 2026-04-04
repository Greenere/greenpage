import { useState, type CSSProperties } from 'react';
import { EDIT_RELATION_ICON, type ConfigurableIcon } from '../../../configs/ui/icons';
import type { EditorConnectedNodeEntry } from '../editorRelations';

function renderConfiguredIcon(icon: ConfigurableIcon, size = icon.size.idle) {
  if (icon.kind === 'unicode') {
    return (
      <span
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          fontFamily: icon.fontFamily ?? 'inherit',
          fontWeight: icon.fontWeight ?? 600,
        }}
        aria-hidden="true"
      >
        {icon.glyph}
      </span>
    );
  }

  if (icon.kind === 'asset-svg') {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const normalizedSrc = icon.src.replace(/^\/+/, '');
    const resolvedSrc = `${base}${normalizedSrc}`;

    if (icon.tintWithCurrentColor) {
      return (
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: 'currentColor',
            WebkitMaskImage: `url("${resolvedSrc}")`,
            maskImage: `url("${resolvedSrc}")`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      );
    }

    return (
      <img
        src={resolvedSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ display: 'block', width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill={icon.fill ?? 'none'}
      stroke={icon.stroke ?? 'currentColor'}
      strokeWidth={icon.strokeWidth ?? 2}
      fillRule={icon.fillRule}
      strokeLinecap={icon.strokeLinecap ?? 'round'}
      strokeLinejoin={icon.strokeLinejoin ?? 'round'}
      aria-hidden="true"
    >
      {icon.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function ConnectedNodeCard({
  entry,
  selected = false,
  onNavigate,
  onInspect,
  onRemove,
}: {
  entry: EditorConnectedNodeEntry;
  selected?: boolean;
  onNavigate?: () => void;
  onInspect?: () => void;
  onRemove?: () => void;
}) {
  const [removeHovered, setRemoveHovered] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const interactive = Boolean(onNavigate);

  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    padding: '0.8rem 0.85rem',
    paddingRight: onInspect || onRemove ? '2.35rem' : '0.85rem',
    borderRadius: '16px',
    border: selected
      ? '1px solid color-mix(in srgb, var(--color-secondary) 46%, transparent)'
      : '1px solid transparent',
    background: selected || cardHovered
      ? 'color-mix(in srgb, var(--color-background) 80%, white 20%)'
      : 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
    color: 'var(--color-text)',
    textDecoration: 'none',
    textAlign: 'left',
    fontFamily: 'inherit',
    cursor: interactive ? 'pointer' : 'default',
    boxShadow: selected || cardHovered
      ? 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-active, 3) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-active, 0.9) * 100%), transparent)'
      : 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-idle, 0) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-idle, 0.8) * 100%), transparent)',
    transform: interactive && cardHovered ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'box-shadow 180ms ease, background-color 180ms ease, transform 180ms ease',
  };

  const content = (
    <>
      <div>
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, fontSize: '0.58rem' }}>
          {entry.displayKind}
        </div>
        <div style={{ marginTop: '0.3rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
          {entry.relatedNodeTitle}
        </div>
        <div style={{ marginTop: '0.38rem', fontSize: '0.76rem', lineHeight: 1.45, opacity: 0.8 }}>
          {entry.displayLabel}
        </div>
      </div>
    </>
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {onNavigate ? (
        <button
          type="button"
          onClick={onNavigate}
          onMouseEnter={() => setCardHovered(true)}
          onMouseLeave={() => setCardHovered(false)}
          onFocus={() => setCardHovered(true)}
          onBlur={() => setCardHovered(false)}
          style={cardStyle}
          aria-label={`Open ${entry.relatedNodeTitle} in the editor`}
        >
          {content}
        </button>
      ) : (
        <div style={cardStyle}>{content}</div>
      )}
      {onInspect && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onInspect(); }}
          onMouseEnter={() => setRemoveHovered(true)}
          onMouseLeave={() => setRemoveHovered(false)}
          onFocus={() => setRemoveHovered(true)}
          onBlur={() => setRemoveHovered(false)}
          style={{
            position: 'absolute',
            top: '0.45rem',
            right: onRemove ? '2rem' : '0.45rem',
            width: '1.45rem',
            height: '1.45rem',
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            color: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            transition: 'color 0.14s ease',
            opacity: selected ? 0 : 1,
            pointerEvents: selected ? 'none' : 'auto',
          }}
          aria-label={`Edit relation to ${entry.relatedNodeTitle}`}
          title={`Edit relation to ${entry.relatedNodeTitle}`}
        >
          <span
            style={{
              width: `${EDIT_RELATION_ICON.size.active}px`,
              height: `${EDIT_RELATION_ICON.size.active}px`,
              display: 'grid',
              placeItems: 'center',
              transform: `scale(${removeHovered ? 1 : EDIT_RELATION_ICON.size.idle / EDIT_RELATION_ICON.size.active})`,
              transformOrigin: 'center center',
              transition: 'transform 0.14s ease',
            }}
          >
            {renderConfiguredIcon(EDIT_RELATION_ICON, EDIT_RELATION_ICON.size.active)}
          </span>
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onRemove(); }}
          onMouseEnter={() => setRemoveHovered(true)}
          onMouseLeave={() => setRemoveHovered(false)}
          onFocus={() => setRemoveHovered(true)}
          onBlur={() => setRemoveHovered(false)}
          style={{
            position: 'absolute',
            top: '0.45rem',
            right: '0.45rem',
            width: '1.45rem',
            height: '1.45rem',
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            color: 'color-mix(in srgb, crimson 72%, var(--color-text))',
            cursor: 'pointer',
            fontSize: removeHovered ? '0.92rem' : '0.72rem',
            fontFamily: 'inherit',
            lineHeight: 1,
            transform: removeHovered ? 'scale(1.14)' : 'scale(1)',
            transition: 'transform 0.14s ease, font-size 0.14s ease, color 0.14s ease',
          }}
          aria-label={`Remove connection to ${entry.relatedNodeTitle}`}
          title={`Remove connection to ${entry.relatedNodeTitle}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
