import React, { useState, useEffect } from 'react';
import api from '../api/auth';
import { useI18n } from '../context/I18nContext';

function LanguageSwitcher() {
  const [languages, setLanguages] = useState([]);
  const { lang, changeLanguage } = useI18n();

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await api.get('/i18n/languages');
        setLanguages(res.data.languages);
      } catch (err) {
        // console.error('Failed to load languages');
      }
    };
    fetchLanguages();
  }, []);

  const handleChange = (e) => {
    const newLang = e.target.value;
    changeLanguage(newLang);
  };

  return (
    <div style={styles.container}>
      <select value={lang} onChange={handleChange} style={styles.select}>
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>{lang.name}</option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  container: { display: 'inline-block' },
  select: {
    padding: '6px 12px',
    borderRadius: '12px',
    border: '2px solid #c8f0ea',
    fontSize: '0.9rem',
    background: 'white',
    cursor: 'pointer',
  },
};

export default LanguageSwitcher;