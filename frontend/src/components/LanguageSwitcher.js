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
    <div className="lang-switcher">
      <select value={lang} onChange={handleChange} className="lang-switcher__select">
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>{lang.name}</option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSwitcher;
