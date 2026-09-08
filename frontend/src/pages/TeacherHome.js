import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function TeacherHome() {
  const { t } = useI18n();
  const [lessons,  setLessons]  = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [filterGroup,  setFilterGroup]  = useState('');
  const [filterCourse, setFilterCourse] = useState('');

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
        <button style={s.btn} onClick={() => {/* создать урок — следующий шаг */}}>
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
            <tr key={l.id} style={s.row}>
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
    </div>
  );
}

const s = {
  wrap:    { padding: '2rem' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filters: { display: 'flex', gap: '8px' },
  select:  { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem' },
  btn:     { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  row:     { borderBottom: '1px solid #e8f4f0', cursor: 'pointer' },
  badge:   { padding: '2px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 600 },
};

export default TeacherHome;