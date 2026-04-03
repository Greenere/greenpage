import { getConfiguredContentLanguageOrder, type AppLanguage } from './config';

export function localeToFileSuffix(locale: AppLanguage): string {
  return locale === 'zh-CN' ? 'zh_cn' : locale;
}

export function getLocaleFallbackOrder(locale: AppLanguage): AppLanguage[] {
  return getConfiguredContentLanguageOrder(locale);
}
