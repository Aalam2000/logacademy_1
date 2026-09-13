import React from 'react';
import { useLang } from '../hooks/useLang';

function LanguageSwitcher() {
  const { lang, languages, changeLanguage } = useLang();

  const handleChange = (e) => {
    const newLang = e.target.value;
    console.log('🔍[i18n-trace] 1. LanguageSwitcher.handleChange: клик, newLang =', newLang, 'текущий lang в этом хуке =', lang);
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