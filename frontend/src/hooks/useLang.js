import {useCallback, useEffect, useState} from 'react';
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
            .catch(() => {
            });
    }, []);

    useEffect(() => {
        const handler = (e) => {
            setLang(e.detail.lang);
        };
        window.addEventListener('autoi18nlangchange', handler);
        return () => window.removeEventListener('autoi18nlangchange', handler);
    }, []);

    const changeLanguage = useCallback((newLang) => {
        setLang(newLang);
        if (window.autoI18n && typeof window.autoI18n.setLanguage === 'function') {
            window.autoI18n.setLanguage(newLang);
        } else {
            localStorage.setItem('autoI18nLang', newLang);
        }
    }, []);

    return {lang, languages, changeLanguage};
}