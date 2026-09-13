import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// Клиентский рантайм autoi18n — подключается один раз в точке входа,
// без единой правки кода компонентов (см. README autoi18n). После загрузки
// он сам проходит по уже отрисованному React-ом DOM и следит за его
// изменениями через MutationObserver.
(function loadAutoI18nRuntime() {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  const lang = localStorage.getItem('autoI18nLang') || 'ru';
  const script = document.createElement('script');
  script.src = `${apiUrl}/i18n/runtime.js?lang=${encodeURIComponent(lang)}`;
  script.async = true;
  document.head.appendChild(script);
})();
