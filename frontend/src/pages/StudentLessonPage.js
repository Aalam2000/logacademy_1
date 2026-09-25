// Read-only страница урока для студента — открытые уроки его группы.
// Не переиспользует LessonPage.js (та завязана на редактирование
// урока/выставление оценок учителем) — отдельный лёгкий компонент на
// том же API-слое. См. claude/student-lesson-view-plan.md.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';
import { TYPE_META, formatSize, subtypeLabel, resourceKey, needsPdfPreview } from '../utils/libraryItems';
import { extractErrorMessage } from '../utils/errors';
import { useAuth } from '../context/AuthContext';
import StudentHomework from '../components/HomeworkStudent';
import { DialogThread } from '../components/LessonDialog';
import { getMyHomework, getMessages } from '../api/homework';

function StudentLessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Вкладки: Материалы | ДЗ | Диалог (набросок «В»). Над вкладками — строка
  // «моя отметка» за урок (посещаемость, оценки, звёзды), только просмотр.
  const [tab, setTab] = useState('materials');
  const [items, setItems] = useState([]);
  const [homework, setHomework] = useState({ tasks: [], answer: { status: 'none', files: [] } });
  const [newMessages, setNewMessages] = useState(0);
  const [mark, setMark] = useState(null); // моя отметка за урок — только просмотр
  const [itemsError, setItemsError] = useState('');
  const [openingKey, setOpeningKey] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setItemsError('');
      try {
        const [lessonRes, itemsRes, hwRes, markRes] = await Promise.all([
          api.get(`/lessons/${lessonId}`),
          api.get(`/lessons/${lessonId}/items`),
          getMyHomework(lessonId),
          api.get(`/lessons/${lessonId}/marks/me`).catch(() => ({ data: null })),
        ]);
        setLesson(lessonRes.data);
        setMark(markRes.data);
        setItems(itemsRes.data);
        setHomework(hwRes);
      } catch (err) {
        setError(extractErrorMessage(err, 'Не удалось загрузить урок'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId]);

  // Счётчик на вкладке «Диалог»: сообщения педагога после моего последнего
  const refreshMessagesCount = async () => {
    if (!user) return;
    try {
      const msgs = await getMessages(lessonId, user.id);
      let n = 0;
      for (let i = msgs.length - 1; i >= 0 && !msgs[i].is_mine; i--) n += 1;
      setNewMessages(n);
    } catch {
      setNewMessages(0);
    }
  };

  useEffect(() => {
    refreshMessagesCount();
    // eslint-disable-next-line
  }, [lessonId, user]);

  const pendingHw = ['pending', 'returned'].includes(homework.answer.status) ? 1 : 0;

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
    return <div className="page">{'Загрузка...'}</div>;
  }

  if (!lesson) {
    return (
      <div className="page">
        {error || 'Урок не найден'}
      </div>
    );
  }

  const TABS = [
    { key: 'materials', label: 'Материалы', count: 0 },
    { key: 'homework', label: 'ДЗ', count: pendingHw },
    { key: 'dialog', label: 'Диалог', count: newMessages },
  ];

  return (
    <div className="page">
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

      {/* Моя отметка за урок — только просмотр: посещаемость, три оценки, звёзды */}
      {mark && (
        <div className="table-scroll">
          <table className="table table--fixed">
            <thead>
              <tr>
                <th className="table__col--attendance">{'Посещаемость'}</th>
                <th className="table__col--score">{'Оценка'}</th>
                <th className="table__col--score">{'Экзамен'}</th>
                <th className="table__col--score">{'ДЗ'}</th>
                <th className="table__col--stars">{'Звёзды'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{mark.status_label}</td>
                <td>{mark.score ?? '—'}</td>
                <td>{mark.exam_score ?? '—'}</td>
                <td>{homework.answer.grade ?? (homework.answer.status === 'accepted' ? '✓' : '—')}</td>
                <td>{'★'.repeat(mark.stars || 0)}{'☆'.repeat(3 - (mark.stars || 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="lesson-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`lesson-tabs__tab${tab === t.key ? ' lesson-tabs__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className="lesson-tabs__count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="lesson-tabs__pane">
        {tab === 'materials' && (
          <>
            {itemsError && <div className="error-text error-text--muted">{itemsError}</div>}
            {items.length === 0 ? (
              <p className="text-muted">{'К уроку ничего не привязано'}</p>
            ) : (
              <div className="material-list">
                {items.map(item => {
                  const meta = TYPE_META[item.resource_type];
                  const key = resourceKey(item.resource_type, item.resource_id);
                  return (
                    <div key={key} className={`material-list__row table__row--${item.resource_type}`}>
                      <span className={`type-badge type-badge--${item.resource_type}`}>
                        {meta.icon} {subtypeLabel(item)}
                      </span>
                      {/* Материал просто открывается в новой вкладке */}
                      <button
                        type="button"
                        className="link material-list__title"
                        data-tip="Открыть в новой вкладке"
                        onClick={() => handleOpenItem(item)}
                        disabled={openingKey === key}
                      >
                        {openingKey === key ? `${item.title} — открываем...` : item.title}
                      </button>
                      {item.resource_type === 'material' && (
                        <span className="text-muted nowrap">{formatSize(item.size_bytes || 0)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {lesson.comment && (
              <div className="lesson-note">
                <b>{'Заметки педагога: '}</b>{lesson.comment}
              </div>
            )}
          </>
        )}

        {tab === 'homework' && (
          <StudentHomework lessonId={lessonId} homework={homework} onUpdated={setHomework} />
        )}

        {tab === 'dialog' && user && (
          <DialogThread lessonId={lessonId} studentId={user.id} onChanged={refreshMessagesCount} />
        )}
      </div>
    </div>
  );
}

export default StudentLessonPage;
