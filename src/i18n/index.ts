import {
  DEFAULT_LANGUAGE_CHOICE,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getDefaultAppLanguage,
  normalizeLanguage,
  type AppLanguage,
} from './config';
import { EN_MESSAGES } from './locales/en';
import { ZH_CN_MESSAGES } from './locales/zh_cn';
import type { LocaleMessages } from './types';

export type { AppLanguage } from './config';
export { DEFAULT_LANGUAGE, DEFAULT_LANGUAGE_CHOICE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY } from './config';

const LOCALE_MESSAGES: Record<AppLanguage, LocaleMessages> = {
  en: EN_MESSAGES,
  'zh-CN': ZH_CN_MESSAGES,
};

let activeLanguage: AppLanguage = DEFAULT_LANGUAGE;

export function getInitialLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    const storedLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (storedLanguage) return storedLanguage;
    return getDefaultAppLanguage(window.navigator.language);
  }

  return DEFAULT_LANGUAGE_CHOICE === 'app-language' ? DEFAULT_LANGUAGE : DEFAULT_LANGUAGE_CHOICE;
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
