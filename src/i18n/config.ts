export type AppLanguage = 'en' | 'zh-CN';

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'greenpage-language';
export const LANGUAGE_OPTIONS = [
  { id: 'en', shortLabel: 'EN' },
  { id: 'zh-CN', shortLabel: '中' },
] as const satisfies ReadonlyArray<{ id: AppLanguage; shortLabel: string }>;

export type DefaultLanguageChoice = 'app-language' | AppLanguage;

// This only controls the initial language choice when the user has not already
// selected and saved a preference. Users can still switch languages normally.
export const DEFAULT_LANGUAGE_CHOICE: DefaultLanguageChoice = 'en';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'zh-CN';
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) return null;
  if (isAppLanguage(value)) return value;
  if (value.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (value.toLowerCase().startsWith('en')) return 'en';
  return null;
}

export function getDefaultAppLanguage(browserLanguage: string | null | undefined): AppLanguage {
  if (DEFAULT_LANGUAGE_CHOICE === 'app-language') {
    return normalizeLanguage(browserLanguage) ?? DEFAULT_LANGUAGE;
  }

  return DEFAULT_LANGUAGE_CHOICE;
}

export function getConfiguredContentLanguageOrder(appLanguage: AppLanguage): AppLanguage[] {
  const ordered = [appLanguage];

  if (appLanguage !== DEFAULT_LANGUAGE) {
    ordered.push(DEFAULT_LANGUAGE);
  }

  for (const option of LANGUAGE_OPTIONS) {
    if (!ordered.includes(option.id)) {
      ordered.push(option.id);
    }
  }

  return ordered;
}
