import React, { useEffect, useState } from 'react';
import api from '../api/auth';

function TeachersDirectoryPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/admin/teachers/directory')
      .then(r => setTeachers(r.data))
      .catch(err => setError(err?.response?.data?.detail || 'Не удалось загрузить справочник'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="toolbar toolbar--start">
        <h1 className="page-title">{'Преподаватели'}</h1>
      </div>

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Имя'}</th>
              <th>{'Групп'}</th>
              <th>{'Студентов'}</th>
              <th>{'Посещаемость'}</th>
              <th>{'Средний балл'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table__empty">{'Загрузка...'}</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan={5} className="table__empty">{'Преподов не найдено'}</td></tr>
            ) : (
              teachers.map(t => (
                <tr key={t.id}>
                  <td>{t.full_name}</td>
                  <td>{t.group_count}</td>
                  <td>{t.student_count}</td>
                  <td>{t.attendance_pct != null ? `${t.attendance_pct}%` : '—'}</td>
                  <td>{t.avg_score ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeachersDirectoryPage;
