import React, { useState, useEffect } from 'react';
import api from '../api/auth';

function StudentHome() {
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    api.get('/lessons/student').then(r => setLessons(r.data));
  }, []);

  return (
    <div className="page">
      <h2>{'Мои уроки'}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>{'Дата'}</th>
            <th>{'Тема'}</th>
          </tr>
        </thead>
        <tbody>
          {lessons.length === 0 && (
            <tr><td colSpan={2} className="table__empty">
              {'Уроков нет'}
            </td></tr>
          )}
          {lessons.map(l => (
            <tr key={l.id}>
              <td>{l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}</td>
              <td>{l.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StudentHome;
