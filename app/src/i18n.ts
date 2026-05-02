import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ta from './locales/ta.json';

const LANGUAGE_KEY = 'appLanguage';

const languageDetectorPlugin = {
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: async function (callback) {
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (language) {
        callback(language);
        return language;
      } else {
        callback('en');
        return 'en';
      }
    } catch (error) {
      callback('en');
      return 'en';
    }
  },
  cacheUserLanguage: async function (language) {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {}
  }
};

i18n
  .use(initReactI18next)
  .use(languageDetectorPlugin)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      ta: { translation: ta }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
