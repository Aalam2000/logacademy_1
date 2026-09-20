// Read-only страница урока для студента — открытые уроки его группы.
// Не переиспользует LessonPage.js (та завязана на редактирование
// урока/выставление оценок учителем) — отдельный лёгкий компонент на
// том же API-слое. См. claude/student-lesson-view-plan.md.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';
import { TYPE_META, formatSize, subtypeLabel, resourceKey, needsPdfPreview } from '../utils/libraryItems';
import { extractErrorMessage } from '../utils/errors';

function StudentLessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mark, setMark] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsError, setItemsError] = useState('');
  const [openingKey, setOpeningKey] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setItemsError('');
      try {
        const [lessonRes, markRes, itemsRes] = await Promise.all([
          api.get(`/lessons/${lessonId}`),
          api.get(`/lessons/${lessonId}/marks/me`),
          api.get(`/lessons/${lessonId}/items`),
        ]);
        setLesson(lessonRes.data);
        setMark(markRes.data);
        setItems(itemsRes.data);
      } catch (err) {
        setError(extractErrorMessage(err, 'Не удалось загрузить урок'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId]);

  // Та же логика открытия файла/ссылки, что в LessonPage.js (blob + JWT
  // для файлов, синхронный window.open по клику, чтобы браузер не считал
  // это всплывающим окном не по действию пользователя) — квизы студенту
  // не приходят, бэкенд их уже отфильтровал.
  const handleOpenItem = async (item) => {
    setItemsError('');

    if (item.resource_type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const key = resourceKey(item.resource_type, item.resource_id);
    setOpeningKey(key);
    const win = window.open('', '_blank');
    const isConverting = needsPdfPreview(item.content_type);
    if (win && isConverting) {
      win.document.write('<p style="font-family:sans-serif;color:#4B5563;padding:24px">Конвертируем файл в PDF...</p>');
      win.document.close();
    }
    try {
      const endpoint = isConverting ? 'preview' : 'download';
      const res = await api.get(`/materials/${item.resource_id}/${endpoint}`, { responseType: 'blob' });
      const fallbackType = endpoint === 'preview' ? 'application/pdf' : (item.content_type || 'application/octet-stream');
      const type = res.headers?.['content-type'] || fallbackType;
      const url = window.URL.createObjectURL(new Blob([res.data], { type }));
      const openUrl = type === 'application/pdf' ? `${url}#navpanes=0` : url;
      if (win) win.location.href = openUrl;
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.close();
      setItemsError(extractErrorMessage(err, 'Не удалось открыть'));
    } finally {
      setOpeningKey(null);
    }
  };

  if (loading) {
    return <div className="page page--md">{'Загрузка...'}</div>;
  }

  if (!lesson) {
    return (
      <div className="page page--md">
        {error || 'Урок не найден'}
      </div>
    );
  }

  return (
    <div className="page page--md">
      <div className="toolbar">
        <div className="lesson-toolbar__info">
          <button className="btn btn--outline" onClick={() => navigate('/dashboard')}>
            {'Назад'}
          </button>
          <span className="lesson-toolbar__group">
            {lesson.title}
            {lesson.date ? ` — ${new Date(lesson.date).toLocaleString('ru-RU')}` : ''}
          </span>
        </div>
      </div>

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="toolbar">
        <h3 className="toolbar__title">{'Моя отметка'}</h3>
      </div>

      {mark && (
        <table className="table table--fixed">
          <thead>
            <tr>
              <th className="table__col--attendance">{'Посещаемость'}</th>
              <th className="table__col--score">{'Оценка'}</th>
              <th className="table__col--score">{'Экзамен'}</th>
              <th className="table__col--stars">{'Звёзды'}</th>
              <th>{'Комментарий'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{mark.status_label}</td>
              <td>{mark.score ?? '—'}</td>
              <td>{mark.exam_score ?? '—'}</td>
              <td>{'★'.repeat(mark.stars || 0)}{'☆'.repeat(3 - (mark.stars || 0))}</td>
              <td>{mark.comment || '—'}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="toolbar">
        <h3 className="toolbar__title">{'Материалы урока'}</h3>
      </div>

      {itemsError && <div className="error-text error-text--muted">{itemsError}</div>}

      <table className="table table--fixed">
        <thead>
          <tr>
            <th>{'Тип'}</th>
            <th>{'Название'}</th>
            <th>{'Детали'}</th>
            <th>{'Добавил'}</th>
            <th className="table__col--date">{'Дата'}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan="5" className="table__empty">{'К уроку ничего не привязано'}</td></tr>
          ) : (
            items.map(item => {
              const meta = TYPE_META[item.resource_type];
              const key = resourceKey(item.resource_type, item.resource_id);
              return (
                <tr key={key} className={`table__row--${item.resource_type}`}>
                  <td>
                    <span className={`type-badge type-badge--${item.resource_type}`}>
                      {meta.icon} {subtypeLabel(item)}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="link" onClick={() => handleOpenItem(item)} disabled={openingKey === key}>
                      {openingKey === key ? `${item.title} — открываем...` : item.title}
                    </button>
                  </td>
                  <td>
                    {item.resource_type === 'material' && (
                      <span className="table__cell--clip">{formatSize(item.size_bytes || 0)}</span>
                    )}
                    {item.resource_type === 'link' && (
                      <span className="table__cell--clip" title={item.url}>{item.url}</span>
                    )}
                  </td>
                  <td>{item.added_by_name || '—'}</td>
                  <td className="table__col--date nowrap">{item.added_at ? new Date(item.added_at).toLocaleDateString('ru-RU') : '—'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <label className="field-label field-label--top-gap">
        {'Комментарий к уроку'}
        <textarea
          className="input input--textarea"
          value={lesson.comment || ''}
          disabled
          readOnly
          placeholder={'Комментариев пока нет'}
        />
      </label>
    </div>
  );
}

export default StudentLessonPage;
