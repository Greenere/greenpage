import { useContext } from 'react';

import { LanguageContext } from './appLanguageContext';

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used within LanguageProvider.');
  }
  return context;
}
