import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getInitialLanguage,
  getLocaleMessages,
  LANGUAGE_STORAGE_KEY,
  setActiveLanguage,
  type AppLanguage,
} from './index';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  messages: ReturnType<typeof getLocaleMessages>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  setActiveLanguage(language);

  const messages = getLocaleMessages(language);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }

    if (typeof document !== 'undefined') {
      document.title = messages.siteMeta.title;
    }
  }, [language, messages]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      messages,
    }),
    [language, messages]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used within LanguageProvider.');
  }
  return context;
}
