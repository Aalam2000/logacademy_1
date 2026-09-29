import React, { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import api from '../api/auth';
import { useLang } from '../hooks/useLang';
import { useInternalLinks } from '../hooks/useInternalLinks';

// «Методика» — методические материалы для педагогов и администраторов.
// Разделы и материалы — папки и .md в backend/templates/methodology
// (см. backend/app/routers/methodology.py); переводы делает autoi18n,
// бэкенд отдаёт нужную языковую версию. Слева — дерево разделов,
// справа — выбранный материал. Адрес материала:
// /dashboard/methodology/<раздел>/<материал> — на него можно ссылаться
// из других материалов и из помощи.
function MethodologyPage() {
  const { section, slug } = useParams();
  const { lang } = useLang();
  const handleLinkClick = useInternalLinks();
  const [tree, setTree] = useState([]);
  const [treeError, setTreeError] = useState('');
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTreeError('');
    api.get('/methodology', { params: { lang } })
      .then(r => setTree(r.data.sections || []))
      .catch(err => setTreeError(err?.response?.data?.detail || 'Не удалось загрузить разделы'));
  }, [lang]);

  useEffect(() => {
    if (!section || !slug) {
      setDoc(null);
      return;
    }
    setLoading(true);
    setError('');
    api.get(`/methodology/${section}/${slug}`, { params: { lang } })
      .then(r => setDoc(r.data))
      .catch(err => setError(err?.response?.data?.detail || 'Не удалось загрузить материал'))
      .finally(() => setLoading(false));
  }, [section, slug, lang]);

  return (
    <div className="page methodology">
      <aside className="methodology__nav">
        <h2 className="methodology__heading">{'Методика преподавания IT детям'}</h2>
        {treeError && <div className="error-text error-text--muted">{treeError}</div>}
        {tree.map(s => (
          <div key={s.slug} className="methodology__section">
            <div className="methodology__section-title">{s.title}</div>
            {s.materials.length === 0 ? (
              <div className="text-muted methodology__empty">{'Материалов пока нет'}</div>
            ) : (
              <ul className="methodology__list">
                {s.materials.map(m => (
                  <li key={m.slug}>
                    <NavLink
                      to={`/dashboard/methodology/${s.slug}/${m.slug}`}
                      className={({ isActive }) => `methodology__link${isActive ? ' methodology__link--active' : ''}`}
                    >
                      {m.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </aside>

      <article className="methodology__content">
        {!section && <p className="text-muted">{'Выберите материал в списке разделов.'}</p>}
        {loading && <div className="table__empty">{'Загрузка...'}</div>}
        {error && <div className="error-text error-text--muted">{error}</div>}
        {!loading && !error && doc && (
          <div className="help-content" onClick={handleLinkClick} dangerouslySetInnerHTML={{ __html: doc.html }} />
        )}
      </article>
    </div>
  );
}

export default MethodologyPage;
