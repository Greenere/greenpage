import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getInitialLanguage,
  getLocaleMessages,
  LANGUAGE_STORAGE_KEY,
  setActiveLanguage,
  type AppLanguage,
} from './index';
import { LanguageContext } from './appLanguageContext';
import { LANGUAGE_SWITCH_TRANSITION_CONFIG } from '../configs/ui/pageTransitions';
import { runWithViewTransition } from '../shared/ui/viewTransitions';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => getInitialLanguage());
  setActiveLanguage(language);

  const messages = getLocaleMessages(language);

  const setLanguage = useCallback((lang: AppLanguage) => {
    if (lang === language) {
      return;
    }

    runWithViewTransition(() => {
      setLanguageState(lang);
    }, { transitionConfig: LANGUAGE_SWITCH_TRANSITION_CONFIG });
  }, [language]);

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
    [language, setLanguage, messages]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
