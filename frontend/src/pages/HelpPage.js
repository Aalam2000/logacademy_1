import React, { useEffect, useState } from 'react';
import api from '../api/auth';
import { useLang } from '../hooks/useLang';

// «Помощь» — обычная страница в правой части, как остальные разделы.
// Инструкция по роли пользователя: backend/app/routers/help.py выбирает
// файл по current_user.role, текст в backend/templates/help/*.html,
// переводится на бэкенде (lang).
function HelpPage() {
  const { lang } = useLang();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/help', { params: { lang } })
      .then(r => setHtml(r.data.html))
      .catch(err => setError(err?.response?.data?.detail || 'Не удалось загрузить инструкцию'))
      .finally(() => setLoading(false));
  }, [lang]);

  return (
    <div className="page help-page">
      <h2>{'Помощь'}</h2>
      {loading && <div className="table__empty">{'Загрузка...'}</div>}
      {error && <div className="error-text error-text--muted">{error}</div>}
      {!loading && !error && <div dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}

export default HelpPage;
