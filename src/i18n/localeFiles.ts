import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, type AppLanguage } from './index';

export function localeToFileSuffix(locale: AppLanguage): string {
  return locale === 'zh-CN' ? 'zh_cn' : locale;
}

export function getLocaleFallbackOrder(locale: AppLanguage): AppLanguage[] {
  const ordered: AppLanguage[] = [locale];

  if (locale !== DEFAULT_LANGUAGE) {
    ordered.push(DEFAULT_LANGUAGE);
  }

  for (const option of LANGUAGE_OPTIONS) {
    if (!ordered.includes(option.id)) {
      ordered.push(option.id);
    }
  }

  return ordered;
}
