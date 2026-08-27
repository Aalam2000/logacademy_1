import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/auth';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ru');
  const [translations, setTranslations] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const res = await api.get(`/i18n/translations?lang=${lang}`);
        // console.log(`📥 Загружены переводы для языка ${lang}:`, res.data);
        // console.log(`📥 Ключи в загруженном словаре:`, Object.keys(res.data));
        setTranslations(res.data);
        localStorage.setItem('lang', lang);
        setLoaded(true);
      } catch {
        // console.error('❌ Ошибка загрузки переводов');
        setTranslations({});
        setLoaded(true);
      }
    };
    fetchTranslations();
  }, [lang]);

  const t = (key, fallback) => {
    const found = translations && translations[key];
    const result = found ? translations[key] : (fallback || key);
    // console.log(`🔍 t('${key}') → ${found ? '✅ НАЙДЕН' : '❌ НЕ НАЙДЕН'}, возвращаем:`, result);
    // console.log(`   Ключи в словаре:`, Object.keys(translations || {}).slice(0, 10)); // первые 10 ключей
    return result;
  };

  const changeLanguage = (newLang) => {
    setLang(newLang);
  };

  return (
    <I18nContext.Provider value={{ lang, t, changeLanguage, loaded }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}