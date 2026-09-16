import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/auth';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

const VALID_THEMES = ['brand', 'playful', 'dark'];
const DEFAULT_THEME = 'brand';

export function ThemeProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  // Подхватываем сохранённую тему пользователя при загрузке/смене юзера
  // (login, обновление профиля, refreshUser() после смены темы).
  useEffect(() => {
    const saved = VALID_THEMES.includes(user?.theme) ? user.theme : DEFAULT_THEME;
    setThemeState(saved);
  }, [user?.theme]);

  // "brand" — это отсутствие атрибута (см. tokens.css): весь :root и есть
  // тема brand по умолчанию, отдельного блока для неё нет.
  useEffect(() => {
    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const setTheme = async (next) => {
    if (!VALID_THEMES.includes(next) || next === theme) return;
    setThemeState(next); // применяем сразу, не дожидаясь ответа сервера
    try {
      await api.put('/auth/me', { theme: next });
      refreshUser();
    } catch (e) {
      // тема всё равно применена локально на эту сессию, просто не
      // сохранилась на сервере — не критично, юзер не должен застрять
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
