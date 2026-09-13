import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';

function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [groupsRes, coursesRes] = await Promise.all([
          api.get('/groups/my'),
          api.get('/groups/courses'),
        ]);
        setGroups(groupsRes.data);
        setCourses(coursesRes.data);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Не удалось загрузить группы');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const courseName = (courseId) =>
    courses.find(c => c.id === courseId)?.title || '—';

  if (loading) return <div style={s.wrap}>{'Загрузка...'}</div>;

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <h2 style={{ margin: 0 }}>{'Мои группы'}</h2>
      </div>

      {error && <div style={s.error}>{error}</div>}

      <table style={s.table}>
        <thead>
          <tr>
            <th>{'Название группы'}</th>
            <th>{'Курс'}</th>
            <th>{'Учеников'}</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {'Групп пока нет'}
              </td>
            </tr>
          )}
          {groups.map(g => (
            <tr
              key={g.id}
              style={s.row}
              onClick={() => navigate(`/dashboard/groups/${g.id}`)}
            >
              <td>{g.name}</td>
              <td>{courseName(g.course_id)}</td>
              <td>{g.student_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s = {
  wrap:    { padding: '2rem' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  btn:     { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  row:     { borderBottom: '1px solid #e8f4f0', cursor: 'pointer' },
  error:   { color: '#B91C1C', fontSize: '0.9rem', marginBottom: '1rem' },
};

export default GroupsPage;