import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '../locales/es.json';
import ca from '../locales/ca.json';
import en from '../locales/en.json';

const savedLang = localStorage.getItem('explorer-lang') || 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    ca: { translation: ca },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('explorer-lang', lng);
});

export default i18n;
