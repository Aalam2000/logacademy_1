import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function StudentHome() {
  const { t } = useI18n();
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    api.get('/lessons/student').then(r => setLessons(r.data));
  }, []);

  return (
    <div style={s.wrap}>
      <h2>{t('home_lessons', 'Мои уроки')}</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th>{t('lesson_date',  'Дата')}</th>
            <th>{t('lesson_title', 'Тема')}</th>
          </tr>
        </thead>
        <tbody>
          {lessons.length === 0 && (
            <tr><td colSpan={2} style={{textAlign:'center', padding:'2rem', color:'#6B7280'}}>
              {t('lesson_empty', 'Уроков нет')}
            </td></tr>
          )}
          {lessons.map(l => (
            <tr key={l.id} style={s.row}>
              <td>{l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}</td>
              <td>{l.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s = {
  wrap:  { padding: '2rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  row:   { borderBottom: '1px solid #e8f4f0' },
};

export default StudentHome;