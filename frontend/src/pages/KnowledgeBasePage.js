import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { TYPE_META, formatSize, subtypeLabel, resourceKey } from '../utils/libraryItems';

function itemKey(item) {
  return resourceKey(item.resource_type, item.id);
}

function KnowledgeBasePage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasRole('admin');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' | material | quiz | link
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState('date'); // date | title
  const [deletingKey, setDeletingKey] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line
  }, [typeFilter, onlyMine, sort]);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort };
      if (typeFilter) params.type = typeFilter;
      if (onlyMine && user) params.uploader = user.id;
      const res = await api.get('/library/items', { params });
      setItems(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить базу знаний');
    } finally {
      setLoading(false);
    }
  };

  // Кнопка сама открывает системный проводник (клик по скрытому input) —
  // выбор файла сразу запускает загрузку, без промежуточного шага.
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    setIsAddingLink(true);
    setError('');
    try {
      await api.post('/links/', { title: linkTitle.trim(), url: linkUrl.trim() });
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось добавить ссылку');
    } finally {
      setIsAddingLink(false);
    }
  };

  // Окно под файл/квиз открываем сразу, синхронно по клику — если открыть
  // его уже после await, браузер считает это всплывающим окном не по
  // действию пользователя и блокирует.
  const handleOpen = async (item) => {
    setError('');

    if (item.resource_type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const win = window.open('', '_blank');
    try {
      if (item.resource_type === 'material') {
        const res = await api.get(`/materials/${item.id}/download`, { responseType: 'blob' });
        const type = res.headers?.['content-type'] || item.content_type || 'application/octet-stream';
        const url = window.URL.createObjectURL(new Blob([res.data], { type }));
        if (win) win.location.href = url;
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const res = await api.get(`/quizzes/${item.id}/html`);
        if (win) {
          win.document.write(res.data.html);
          win.document.close();
        }
      }
    } catch (err) {
      if (win) win.close();
      setError(err?.response?.data?.detail || 'Не удалось открыть');
    }
  };

  const canDelete = (item) => {
    if (item.attached_lessons_count > 0) return false;
    if (item.resource_type === 'quiz') return isAdmin || item.uploaded_by === user?.id;
    return isAdmin; // файлы и ссылки — только admin
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Удалить «${item.title}» из базы знаний?`);
    if (!confirmed) return;

    const key = itemKey(item);
    const path = item.resource_type === 'material' ? 'materials'
      : item.resource_type === 'quiz' ? 'quizzes' : 'links';

    setDeletingKey(key);
    setError('');
    try {
      await api.delete(`/${path}/${item.id}`);
      setItems(prev => prev.filter(i => itemKey(i) !== key));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось удалить');
    } finally {
      setDeletingKey(null);
    }
  };

  const columnCount = 7;

  return (
    <div className="page">
      <div className="toolbar toolbar--underline-row">
        <div className="toolbar__filters">
          <button type="button" className={`tab tab--underline${typeFilter === '' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('')}>
            {'Все'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'material' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('material')}>
            {'Файлы'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'link' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('link')}>
            {'Ссылки'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'quiz' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('quiz')}>
            {'Квизы'}
          </button>
        </div>
        <div className="toolbar__filters">
          <button type="button" className={`tab tab--underline${onlyMine ? ' tab--active' : ''}`} onClick={() => setOnlyMine(v => !v)}>
            {'Моё'}
          </button>
          <select className="input" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="date">{'По дате'}</option>
            <option value="title">{'По названию'}</option>
          </select>
        </div>
      </div>

      <div className="form-toolbar">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          hidden
        />
        <button type="button" className="btn" onClick={handlePickFile} disabled={isUploading}>
          {isUploading ? 'Загрузка...' : 'Загрузить файл'}
        </button>
        <button type="button" className="btn btn--outline" onClick={() => setShowLinkForm(v => !v)}>
          {'+ Добавить ссылку'}
        </button>
        <button type="button" className="btn btn--outline" onClick={() => navigate('/dashboard/add-quiz')}>
          {'+ Создать квиз'}
        </button>
      </div>

      {showLinkForm && (
        <div className="form-toolbar">
          <input
            type="text"
            className="input"
            placeholder={'Название ссылки'}
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={'https://...'}
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            onClick={handleAddLink}
            disabled={isAddingLink || !linkTitle.trim() || !linkUrl.trim()}
          >
            {isAddingLink ? 'Добавление...' : 'Сохранить'}
          </button>
        </div>
      )}

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Тип'}</th>
              <th>{'Название'}</th>
              <th>{'Детали'}</th>
              <th>{'Загрузил'}</th>
              <th>{'Дата'}</th>
              <th>{'В уроках'}</th>
              <th>{'Удалить'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table__empty">{'Загрузка...'}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={columnCount} className="table__empty">{'В базе знаний пока пусто'}</td></tr>
            ) : (
              items.map(item => {
                const meta = TYPE_META[item.resource_type];
                const key = itemKey(item);
                const deletable = canDelete(item);
                return (
                  <tr key={key} className={`table__row--${item.resource_type}`}>
                    <td>
                      <span className={`type-badge type-badge--${item.resource_type}`}>
                        {meta.icon} {subtypeLabel(item)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="link" onClick={() => handleOpen(item)}>
                        {item.title}
                      </button>
                    </td>
                    <td className="nowrap">
                      {item.resource_type === 'material' && formatSize(item.size_bytes || 0)}
                      {item.resource_type === 'quiz' && (item.topic || '—')}
                      {item.resource_type === 'link' && (
                        <span className="table__cell--truncate" title={item.url}>{item.url}</span>
                      )}
                    </td>
                    <td>{item.uploaded_by_name || '—'}</td>
                    <td className="nowrap">{new Date(item.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="nowrap">{item.attached_lessons_count > 0 ? item.attached_lessons_count : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => handleDelete(item)}
                        disabled={!deletable || deletingKey === key}
                        title={item.attached_lessons_count > 0 ? 'Сначала отвяжите от уроков' : undefined}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default KnowledgeBasePage;
