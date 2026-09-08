import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function TeacherHome() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [lessons,  setLessons]  = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [filterGroup,  setFilterGroup]  = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLessonGroup, setNewLessonGroup] = useState('');
  const [newLessonDate, setNewLessonDate] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    api.get('/lessons/my').then(r => setLessons(r.data));
    api.get('/groups/my').then(r => setGroups(r.data));
    api.get('/groups/courses').then(r => setCourses(r.data));
  }, []);

  // Связанные фильтры
  const availableGroups = filterCourse
    ? groups.filter(g => g.course_id === parseInt(filterCourse))
    : groups;

  const availableCourses = filterGroup
    ? courses.filter(c => c.id === groups.find(g => g.id === parseInt(filterGroup))?.course_id)
    : courses;

  // Автозаполнение курса если у группы он один
  const handleGroupChange = (gid) => {
    setFilterGroup(gid);
    if (gid) {
      const group = groups.find(g => g.id === parseInt(gid));
      if (group) setFilterCourse(String(group.course_id));
    } else {
      setFilterCourse('');
    }
  };

  const filtered = lessons.filter(l => {
    if (filterGroup  && l.group_id !== parseInt(filterGroup))  return false;
    if (filterCourse && groups.find(g => g.id === l.group_id)?.course_id !== parseInt(filterCourse)) return false;
    return true;
  });

  // По умолчанию — с сегодня
  const today = new Date(); today.setHours(0,0,0,0);
  const visible = filtered.filter(l => !l.date || new Date(l.date) >= today);

  const groupName  = (id) => groups.find(g => g.id === id)?.name || '—';
  const courseName = (id) => {
    const g = groups.find(gr => gr.id === id);
    return courses.find(c => c.id === g?.course_id)?.title || '—';
  };

  const openCreateModal = () => {
    setCreateError('');
    setNewLessonDate('');
    if (filterGroup) {
      setNewLessonGroup(filterGroup);
    } else if (availableGroups.length === 1) {
      setNewLessonGroup(String(availableGroups[0].id));
    } else {
      setNewLessonGroup('');
    }
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setCreateError('');
    setIsCreating(false);
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!newLessonGroup || !newLessonDate) {
      setCreateError(t('lesson_create_required', 'Выберите группу и дату/время начала урока'));
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const payload = {
        group_id: parseInt(newLessonGroup),
        title: t('lesson_default_title', 'Урок'),
        date: new Date(newLessonDate).toISOString(),
      };
      const created = await api.post('/lessons/', payload);
      setLessons(prev => [...prev, created.data]);
      closeCreateModal();
    } catch (err) {
      setCreateError(err?.response?.data?.detail || t('lesson_create_error', 'Не удалось создать урок'));
      setIsCreating(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <h2 style={{margin:0}}>{t('home_lessons', 'Уроки')}</h2>
        <div style={s.filters}>
          <select style={s.select} value={filterGroup} onChange={e => handleGroupChange(e.target.value)}>
            <option value="">{t('filter_all_groups', '— Все группы —')}</option>
            {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select style={s.select} value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterGroup(''); }}>
            <option value="">{t('filter_all_courses', '— Все курсы —')}</option>
            {availableCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <button style={s.btn} onClick={openCreateModal}>
          {t('lesson_add', '+ Урок')}
        </button>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th>{t('lesson_date',   'Дата')}</th>
            <th>{t('lesson_title',  'Тема урока')}</th>
            <th>{t('lesson_group',  'Группа')}</th>
            <th>{t('lesson_course', 'Курс')}</th>
            <th>{t('lesson_status', 'Доступ')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr><td colSpan={5} style={{textAlign:'center', padding:'2rem', color:'#6B7280'}}>
              {t('lesson_empty', 'Уроков нет')}
            </td></tr>
          )}
          {visible.map(l => (
            <tr key={l.id} style={s.row} onClick={() => navigate(`/dashboard/lessons/${l.id}`)}>
              <td>{l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}</td>
              <td>{l.title}</td>
              <td>{groupName(l.group_id)}</td>
              <td>{courseName(l.group_id)}</td>
              <td>
                <span style={{...s.badge, background: l.is_open ? '#3B6D11' : '#6B7280'}}>
                  {l.is_open ? t('lesson_open', 'Открыт') : t('lesson_closed', 'Закрыт')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div style={s.modalBackdrop}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{t('lesson_create_title', 'Новый урок')}</h3>
            <form onSubmit={handleCreateLesson} style={s.modalForm}>
              <label style={s.label}>
                {t('lesson_group', 'Группа')}
                <select
                  style={s.select}
                  value={newLessonGroup}
                  onChange={e => setNewLessonGroup(e.target.value)}
                  required
                >
                  <option value="">{t('lesson_select_group', '— Выберите группу —')}</option>
                  {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>

              <label style={s.label}>
                {t('lesson_start_datetime', 'Дата и время начала')}
                <input
                  type="datetime-local"
                  style={s.input}
                  value={newLessonDate}
                  onChange={e => setNewLessonDate(e.target.value)}
                  required
                />
              </label>

              {createError && <div style={s.error}>{createError}</div>}

              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeCreateModal}>
                  {t('cancel', 'Отмена')}
                </button>
                <button type="submit" style={s.btn} disabled={isCreating}>
                  {isCreating ? t('saving', 'Сохранение...') : t('create', 'Создать')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:    { padding: '2rem' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filters: { display: 'flex', gap: '8px' },
  select:  { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem' },
  btn:     { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnSecondary: { padding: '8px 20px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  row:     { borderBottom: '1px solid #e8f4f0', cursor: 'pointer' },
  badge:   { padding: '2px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 600 },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '100%', maxWidth: '420px', background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.2)' },
  modalTitle: { margin: '0 0 1rem 0' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '0.8rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem', color: '#111827' },
  input: { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem' },
  error: { color: '#B91C1C', fontSize: '0.85rem' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.6rem' },
};

export default TeacherHome;