import { createContext } from 'react';

import type { AppLanguage } from './index';
import type { LocaleMessages } from './types';

export type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  messages: LocaleMessages;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
