import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <I18nProvider>
      <App />
    </I18nProvider>
  </BrowserRouter>
);