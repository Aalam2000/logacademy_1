// Текущий язык интерфейса и его переключение.
//
// Это НЕ обёртка перевода (autoi18n больше не требует таких вызовов —
// он сам подменяет видимый текст на странице). Это просто источник
// правды о том, какой язык сейчас выбран — нужен там, где приложению
// самому важно знать текущий язык (переключатель языка, выбор языка
// при создании квиза), а не для перевода текста.
import { useState, useEffect, useCallback } from 'react';
import api from '../api/auth';

export function useLang() {
  const [languages, setLanguages] = useState([]);
  const [lang, setLang] = useState(
    (window.autoI18n && window.autoI18n.currentLang) ||
    localStorage.getItem('autoI18nLang') ||
    'ru'
  );

  useEffect(() => {
    api.get('/i18n/languages')
      .then(res => setLanguages(res.data.languages))
      .catch(() => {});
  }, []);

  // Разные компоненты (LanguageSwitcher, AddQuizPage и т.д.) держат СВОИ
  // независимые копии этого хука. Раньше переключение языка в одном месте
  // было никак не видно уже смонтированным компонентам в другом месте —
  // рантайм при setLanguage() теперь шлёт это событие, подписываемся,
  // чтобы все копии lang оставались синхронными друг с другом.
  useEffect(() => {
    const handler = (e) => {
      console.log('🔍[i18n-trace] 4. useLang: получено событие autoi18nlangchange, lang =', e.detail.lang);
      setLang(e.detail.lang);
    };
    window.addEventListener('autoi18nlangchange', handler);
    return () => window.removeEventListener('autoi18nlangchange', handler);
  }, []);

  const changeLanguage = useCallback((newLang) => {
    console.log('🔍[i18n-trace] 2. useLang.changeLanguage: newLang =', newLang,
      '| window.autoI18n есть?', !!window.autoI18n,
      '| setLanguage есть?', !!(window.autoI18n && typeof window.autoI18n.setLanguage === 'function'));
    setLang(newLang);
    if (window.autoI18n && typeof window.autoI18n.setLanguage === 'function') {
      window.autoI18n.setLanguage(newLang);
    } else {
      console.log('🔍[i18n-trace] 2b. window.autoI18n НЕДОСТУПЕН — рантайм не загрузился, пишем только в localStorage');
      localStorage.setItem('autoI18nLang', newLang);
    }
  }, []);

  return { lang, languages, changeLanguage };
}
