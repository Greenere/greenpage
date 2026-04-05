import React from 'react';

import { THEME_CONFIG, THEME_ORDER, type Theme } from '../../configs/ui/themes';

type ThemePickerProps = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  variant?: 'floating' | 'inline';
  children?: React.ReactNode;
};

const ThemePicker: React.FC<ThemePickerProps> = ({ theme, setTheme, variant = 'floating', children }) => {
  const isInline = variant === 'inline';
  const floatingColumnCount = Math.min(5, THEME_ORDER.length);

  return (
    <div
      style={{
        width: isInline ? 'auto' : 'fit-content',
        paddingTop: isInline ? 0 : '0.28rem',
        paddingLeft: isInline ? 0 : '0.34rem',
        paddingRight: isInline ? 0 : '0.34rem',
        border: '1px solid transparent',
        borderRadius: isInline ? 0 : '13px',
        textAlign: 'center',
        background: isInline ? 'transparent' : 'color-mix(in srgb, var(--color-background) 88%, white 12%)',
        backdropFilter: isInline ? 'none' : 'blur(6px)',
        boxShadow: isInline
          ? 'none'
          : 'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) var(--greenpage-node-ring-color, color-mix(in srgb, var(--color-secondary) 38%, transparent))',
        transition: 'box-shadow 170ms ease, background-color 170ms ease',
        display: isInline ? 'flex' : 'block',
        alignItems: isInline ? 'center' : undefined,
        justifyContent: isInline ? 'flex-end' : undefined,
        gap: isInline ? '0.18rem' : undefined,
      }}
    >
      {!isInline && (
        <div
          style={{
            fontSize: '0.5rem',
          }}
        >
          {THEME_CONFIG[theme].label}
        </div>
      )}
      <div
        style={{
          display: isInline ? 'flex' : 'grid',
          gridTemplateColumns: isInline ? undefined : `repeat(${floatingColumnCount}, 1rem)`,
          gridAutoRows: isInline ? undefined : '1rem',
          gridAutoFlow: isInline ? undefined : 'row',
          justifyContent: isInline ? undefined : 'center',
          alignItems: isInline ? 'center' : undefined,
          flexWrap: isInline ? 'nowrap' : undefined,
          gap: isInline ? '0.18rem' : '0.24rem',
          marginTop: isInline ? 0 : '0.14rem',
          marginBottom: isInline ? 0 : '0.08rem',
        }}
      >
        {THEME_ORDER.map((key) => {
          return (
            <button
              key={key}
              type="button"
              aria-label={THEME_CONFIG[key].label}
              title={isInline ? THEME_CONFIG[key].label : undefined}
              onClick={(event) => {
                setTheme(key);
                event.currentTarget.blur();
              }}
              style={{
                background: THEME_CONFIG[key].colors.primary,
                display: 'inline-block',
                borderRadius: '50%',
                width: '1rem',
                height: '1rem',
                margin: 0,
                border: `1px ${theme === key ? 'solid' : 'dotted'} var(--color-secondary)`,
                padding: 0,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
          );
        })}
      </div>
      {!isInline && children ? (
        <div
          style={{
            marginTop: '0.22rem',
            paddingTop: '0.22rem',
            paddingBottom: '0.14rem',
            borderTop: '1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent)',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(ThemePicker);
