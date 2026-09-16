import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { StudentContactIcons } from '../components/ContactIcons';

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

  if (loading) return <div className="page">{'Загрузка...'}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2 className="toolbar__title">{'Мои группы'}</h2>
      </div>

      {error && <div className="error-text error-text--top">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>{'Название группы'}</th>
            <th>{'Курс'}</th>
            <th>{'Учеников'}</th>
            <th>{'Контакты'}</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={4} className="table__empty">
                {'Групп пока нет'}
              </td>
            </tr>
          )}
          {groups.map(g => (
            <tr
              key={g.id}
              className="table__row--clickable"
              onClick={() => navigate(`/dashboard/groups/${g.id}`)}
            >
              <td>{g.name}</td>
              <td>{courseName(g.course_id)}</td>
              <td>{g.student_count ?? 0}</td>
              <td>
                <StudentContactIcons telegram={g.telegram_chat_id} whatsapp={g.whatsapp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GroupsPage;
