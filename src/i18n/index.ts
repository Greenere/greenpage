import { EN_MESSAGES } from './locales/en';
import { ZH_CN_MESSAGES } from './locales/zh_cn';
import type { LocaleMessages } from './types';

export type AppLanguage = 'en' | 'zh-CN';

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'greenpage-language';
export const LANGUAGE_OPTIONS = [
  { id: 'en', shortLabel: 'EN' },
  { id: 'zh-CN', shortLabel: '中' },
] as const satisfies ReadonlyArray<{ id: AppLanguage; shortLabel: string }>;

const LOCALE_MESSAGES: Record<AppLanguage, LocaleMessages> = {
  en: EN_MESSAGES,
  'zh-CN': ZH_CN_MESSAGES,
};

let activeLanguage: AppLanguage = DEFAULT_LANGUAGE;

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'zh-CN';
}

function normalizeLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) return null;
  if (isAppLanguage(value)) return value;
  if (value.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (value.toLowerCase().startsWith('en')) return 'en';
  return null;
}

export function getInitialLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    const storedLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (storedLanguage) return storedLanguage;
    const browserLanguage = normalizeLanguage(window.navigator.language);
    if (browserLanguage) return browserLanguage;
  }

  return DEFAULT_LANGUAGE;
}

export function getActiveLanguage() {
  return activeLanguage;
}

export function setActiveLanguage(language: AppLanguage) {
  activeLanguage = language;
}

export function getLocaleMessages(language: AppLanguage = activeLanguage) {
  return LOCALE_MESSAGES[language];
}

export function createLocaleProxy<T extends object>(select: (messages: LocaleMessages) => T): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      return Reflect.get(select(getLocaleMessages()), property, receiver);
    },
    has(_target, property) {
      return property in select(getLocaleMessages());
    },
    ownKeys() {
      return Reflect.ownKeys(select(getLocaleMessages()));
    },
    getOwnPropertyDescriptor(_target, property) {
      return Object.getOwnPropertyDescriptor(select(getLocaleMessages()), property);
    },
  });
}
