import React from 'react';
import { useTheme } from '../context/ThemeContext';

const THEMES = [
  { id: 'brand', label: 'Бренд' },
  { id: 'playful', label: 'Playful' },
  { id: 'dark', label: 'Тёмная' },
];

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher">
      {THEMES.map(t => (
        <button
          key={t.id}
          type="button"
          className={`tab${theme === t.id ? ' tab--active' : ''}`}
          onClick={() => setTheme(t.id)}
          title={t.label}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default ThemeSwitcher;
