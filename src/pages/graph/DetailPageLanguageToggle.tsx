import { LANGUAGE_OPTIONS } from '../../i18n';
import { useAppLanguage } from '../../i18n/useAppLanguage';

export default function DetailPageLanguageToggle() {
  const { language, setLanguage, messages } = useAppLanguage();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.2rem',
      }}
      aria-label={messages.appShell.languageLabel}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const selected = option.id === language;
        const label = messages.appShell.languageOptions[option.id];

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLanguage(option.id)}
            aria-pressed={selected}
            aria-label={messages.appShell.languageMenuLabel(label)}
            title={label}
            style={{
              padding: '0.12rem 0.25rem',
              border: 'none',
              background: 'transparent',
              color: selected ? 'var(--color-text)' : 'color-mix(in srgb, var(--color-text) 58%, transparent)',
              fontSize: '0.75rem',
              fontWeight: selected ? 700 : 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1.2,
            }}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
