import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { StudentContactIcons } from '../components/ContactIcons';
import Dropdown from '../components/Dropdown';

function GroupsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allGroups, setAllGroups] = useState([]); // только у admin — для списка «Препод»
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Выбор «Препод/Мои» запоминаем в localStorage — чтобы не сбрасывался
  // при возврате на страницу (уходишь в группу и назад — фильтр на месте).
  const [teacherId, setTeacherId] = useState(() => localStorage.getItem('la_groups_teacherId') || '');
  const [mine, setMine] = useState(() => {
    const stored = localStorage.getItem('la_groups_mine');
    return stored === null ? true : stored === 'true'; // у admin по умолчанию — только свои группы
  });

  useEffect(() => {
    localStorage.setItem('la_groups_teacherId', teacherId);
  }, [teacherId]);

  useEffect(() => {
    localStorage.setItem('la_groups_mine', String(mine));
  }, [mine]);

  // Курсы и (у admin) полный список групп — один раз, для фильтров.
  useEffect(() => {
    api.get('/groups/courses').then(r => setCourses(r.data)).catch(() => {});
    if (isAdmin) {
      api.get('/admin/groups').then(r => setAllGroups(r.data)).catch(() => {});
    }
    // eslint-disable-next-line
  }, [isAdmin]);

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line
  }, [teacherId, mine]);

  const loadGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (isAdmin && mine) params.mine = true;
      if (isAdmin && !mine && teacherId) params.teacher_id = teacherId;
      const res = await api.get('/groups/my', { params });
      setGroups(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  };

  const courseName = (courseId) =>
    courses.find(c => c.id === courseId)?.title || '—';

  // Список преподавателей — из полного списка групп (только те, у кого
  // реально есть группы), тот же приём, что и в StudentsPage.
  const teacherOptions = isAdmin
    ? Array.from(
        new Map(allGroups.map(g => [g.teacher_id, g.teacher_name || `#${g.teacher_id}`])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  const handleMineToggle = () => {
    setMine(v => {
      const next = !v;
      if (next) setTeacherId('');
      return next;
    });
  };

  if (loading) return <div className="page">{'Загрузка...'}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2 className="toolbar__title">{isAdmin ? 'Группы' : 'Мои группы'}</h2>
      </div>

      {isAdmin && (
        <div className="toolbar__filters">
          <Dropdown
            value={mine ? '' : teacherId}
            disabled={mine}
            onChange={v => setTeacherId(v)}
            placeholder={'Учитель — все'}
            options={teacherOptions.map(([id, name]) => ({ value: id, label: name }))}
          />
          <button type="button" className={`tab tab--underline${mine ? ' tab--active' : ''}`} onClick={handleMineToggle}>
            {'Мои'}
          </button>
        </div>
      )}

      {error && <div className="error-text error-text--top">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>{'Название группы'}</th>
            <th>{'Курс'}</th>
            {isAdmin && !mine && !teacherId && <th>{'Учитель'}</th>}
            <th>{'Учеников'}</th>
            <th>{'Контакты'}</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={isAdmin && !mine && !teacherId ? 5 : 4} className="table__empty">
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
              {isAdmin && !mine && !teacherId && <td>{g.teacher_name || `#${g.teacher_id}`}</td>}
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
