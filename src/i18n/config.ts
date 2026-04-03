export type AppLanguage = 'en' | 'zh-CN';

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'greenpage-language';
export const LANGUAGE_OPTIONS = [
  { id: 'en', shortLabel: 'EN' },
  { id: 'zh-CN', shortLabel: '中' },
] as const satisfies ReadonlyArray<{ id: AppLanguage; shortLabel: string }>;

export type ContentLanguageBehavior =
  | { mode: 'app-language' }
  | { mode: 'language-list'; languages: AppLanguage[] };

export const CONTENT_LANGUAGE_BEHAVIOR: ContentLanguageBehavior = {
  mode: 'language-list',
  languages: ['en', 'zh-CN'],
};

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

export function getConfiguredContentLanguageOrder(appLanguage: AppLanguage): AppLanguage[] {
  const ordered =
    CONTENT_LANGUAGE_BEHAVIOR.mode === 'language-list'
      ? [...CONTENT_LANGUAGE_BEHAVIOR.languages]
      : [appLanguage, DEFAULT_LANGUAGE];

  for (const option of LANGUAGE_OPTIONS) {
    if (!ordered.includes(option.id)) {
      ordered.push(option.id);
    }
  }

  return ordered;
}
