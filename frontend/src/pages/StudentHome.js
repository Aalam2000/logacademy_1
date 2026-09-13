import React, { useState, useEffect } from 'react';
import api from '../api/auth';

function StudentHome() {
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    api.get('/lessons/student').then(r => setLessons(r.data));
  }, []);

  return (
    <div style={s.wrap}>
      <h2>{'Мои уроки'}</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th>{'Дата'}</th>
            <th>{'Тема'}</th>
          </tr>
        </thead>
        <tbody>
          {lessons.length === 0 && (
            <tr><td colSpan={2} style={{textAlign:'center', padding:'2rem', color:'#6B7280'}}>
              {'Уроков нет'}
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