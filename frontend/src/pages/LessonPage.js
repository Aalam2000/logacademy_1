import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [lesson, setLesson] = useState(null);
  const [groups, setGroups] = useState([]);
  const [dateValue, setDateValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [lessonRes, groupsRes] = await Promise.all([
          api.get(`/lessons/${lessonId}`),
          api.get('/groups/my'),
        ]);
        setLesson(lessonRes.data);
        setGroups(groupsRes.data);
        setDateValue(toInputDateTime(lessonRes.data?.date));
      } catch (err) {
        setError(err?.response?.data?.detail || t('lesson_load_error', 'Не удалось загрузить урок'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId, t]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!lesson) return;

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        date: dateValue ? new Date(dateValue).toISOString() : null,
      };
      const res = await api.patch(`/lessons/${lesson.id}`, payload);
      setLesson(res.data);
      setDateValue(toInputDateTime(res.data?.date));
    } catch (err) {
      setError(err?.response?.data?.detail || t('lesson_save_error', 'Не удалось сохранить изменения'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOpen = async () => {
    if (!lesson) return;

    setIsTogglingOpen(true);
    setError('');
    try {
      const res = await api.patch(`/lessons/${lesson.id}/open`);
      setLesson(prev => ({ ...prev, is_open: res.data.is_open }));
    } catch (err) {
      setError(err?.response?.data?.detail || t('lesson_open_error', 'Не удалось изменить доступ к уроку'));
    } finally {
      setIsTogglingOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!lesson || isDeleting) return;
    const confirmed = window.confirm(t('lesson_delete_confirm', 'Удалить этот урок?'));
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/lessons/${lesson.id}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || t('lesson_delete_error', 'Не удалось удалить урок'));
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div style={s.wrap}>{t('loading', 'Загрузка...')}</div>;
  }

  if (!lesson) {
    return (
      <div style={s.wrap}>
        {error || t('lesson_not_found', 'Урок не найден')}
      </div>
    );
  }

  const groupName = groups.find(g => g.id === lesson.group_id)?.name || `#${lesson.group_id}`;

  return (
    <div style={s.wrap}>
      <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
        {t('back', 'Назад')}
      </button>

      <h2 style={{ marginTop: '0.75rem' }}>{lesson.title}</h2>

      <div style={s.meta}>
        <span>{t('lesson_group', 'Группа')}: {groupName}</span>
        <span style={{ ...s.badge, background: lesson.is_open ? '#3B6D11' : '#6B7280' }}>
          {lesson.is_open ? t('lesson_open', 'Открыт') : t('lesson_closed', 'Закрыт')}
        </span>
      </div>

      <form onSubmit={handleSave} style={s.form}>
        <label style={s.label}>
          {t('lesson_start_datetime', 'Дата и время начала')}
          <input
            type="datetime-local"
            style={s.input}
            value={dateValue}
            onChange={e => setDateValue(e.target.value)}
          />
        </label>

        <div style={s.actions}>
          <button type="submit" style={s.btn} disabled={isSaving}>
            {isSaving ? t('saving', 'Сохранение...') : t('save', 'Сохранить')}
          </button>
          <button type="button" style={s.btnOpen} onClick={handleToggleOpen} disabled={isTogglingOpen}>
            {isTogglingOpen
              ? t('saving', 'Сохранение...')
              : lesson.is_open
                ? t('lesson_close_btn', 'Закрыть урок')
                : t('lesson_open_btn', 'Открыть урок')}
          </button>
          <button type="button" style={s.btnDelete} onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? t('saving', 'Сохранение...') : t('delete', 'Удалить')}
          </button>
        </div>
      </form>

      {error && <div style={s.error}>{error}</div>}
    </div>
  );
}

function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const s = {
  wrap: { padding: '2rem', maxWidth: '760px' },
  backBtn: { padding: '6px 14px', border: '1px solid #c8f0ea', borderRadius: '8px', background: 'white', cursor: 'pointer' },
  meta: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' },
  badge: { padding: '2px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white', border: '1px solid #e8f4f0', borderRadius: '12px', padding: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' },
  input: { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem', width: '100%', maxWidth: '280px' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  btn: { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnOpen: { padding: '8px 20px', background: '#2E5FA3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnDelete: { padding: '8px 20px', background: '#e05050', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  error: { marginTop: '0.8rem', color: '#B91C1C', fontSize: '0.9rem' },
};

export default LessonPage;