import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();

  // Full app UI language (controlled from Settings page)
  const [language, setLanguageState] = useState(() => localStorage.getItem('preferredLanguage') || 'en');

  // Bill/print language
  const [printLanguage, setPrintLanguageState] = useState(() => localStorage.getItem('printLanguage') || 'en');

  // Item name display language - ONLY for food/grocery item names (controlled by toggle button)
  const [itemNameLanguage, setItemNameLanguageState] = useState(() => localStorage.getItem('itemNameLanguage') || 'en');

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    localStorage.setItem('preferredLanguage', lang);
    i18n.changeLanguage(lang);
  }, [i18n]);

  const setPrintLanguage = useCallback((lang) => {
    setPrintLanguageState(lang);
    localStorage.setItem('printLanguage', lang);
  }, []);

  const setItemNameLanguage = useCallback((lang) => {
    setItemNameLanguageState(lang);
    localStorage.setItem('itemNameLanguage', lang);
  }, []);

  // Helper: returns true if item names should show in Tamil
  const showTamilName = itemNameLanguage === 'ta';

  // Sync i18n language on first mount
  useEffect(() => {
    i18n.changeLanguage(language);
  }, []); // eslint-disable-line

  return (
    <LanguageContext.Provider value={{
      language, setLanguage,
      printLanguage, setPrintLanguage,
      itemNameLanguage, setItemNameLanguage,
      showTamilName
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
