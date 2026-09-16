import React, { useEffect, useState } from 'react';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../hooks/useLang';
import { StudentContactIcons } from '../components/ContactIcons';

function StudentsPage() {
  const { user, hasRole } = useAuth();
  const { lang } = useLang();
  const isAdmin = hasRole('admin');

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [courseId, setCourseId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState('name'); // name | score

  // Курсы и группы — для фильтров. Группы у admin — все (чтобы построить
  // и список «Группа», и список «Препод» по teacher_name), у teacher —
  // только свои (тот же смысл, что и «Моё» у admin).
  useEffect(() => {
    api.get('/groups/courses').then(r => setCourses(r.data)).catch(() => {});
    const groupsUrl = isAdmin ? '/admin/groups' : '/groups/my';
    api.get(groupsUrl).then(r => setGroups(r.data)).catch(() => {});
    // eslint-disable-next-line
  }, [isAdmin]);

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line
  }, [courseId, groupId, teacherId, mine, sort]);

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort };
      if (courseId) params.course_id = courseId;
      if (groupId) params.group_id = groupId;
      if (isAdmin && mine) params.mine = true;
      if (isAdmin && !mine && teacherId) params.teacher_id = teacherId;
      const res = await api.get('/students', { params });
      setStudents(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить список студентов');
    } finally {
      setLoading(false);
    }
  };

  // Открываем окно СИНХРОННО по клику (до await) — иначе браузер считает
  // это попапом не по действию пользователя и блокирует (тот же приём,
  // что и в KnowledgeBasePage.handleOpen).
  const handleOpenCard = async (studentId) => {
    setError('');
    const win = window.open('', '_blank');
    try {
      const res = await api.get(`/students/${studentId}/card`, {
        params: { lang },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (win) win.location.href = url;
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.close();
      setError(err?.response?.data?.detail || 'Не удалось сформировать карточку');
    }
  };

  // Список преподавателей — из уже загруженных групп (только те, у кого
  // реально есть группы), а не отдельным запросом.
  const teacherOptions = isAdmin
    ? Array.from(
        new Map(groups.map(g => [g.teacher_id, g.teacher_name || `#${g.teacher_id}`])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  // Группы в выпадающем списке сужаем по уже выбранным Теме/Преподу.
  const groupOptions = groups.filter(g => {
    if (courseId && String(g.course_id) !== String(courseId)) return false;
    if (isAdmin && !mine && teacherId && String(g.teacher_id) !== String(teacherId)) return false;
    return true;
  });

  const handleMineToggle = () => {
    setMine(v => {
      const next = !v;
      if (next) setTeacherId('');
      return next;
    });
  };

  // «Препод» показываем только пока admin смотрит сводно (не выбран ни
  // конкретный препод, ни «Моё») — иначе колонка избыточна, все и так его.
  const showTeacherColumn = isAdmin && !mine && !teacherId;
  const columnCount = 7 + (showTeacherColumn ? 1 : 0);

  return (
    <div className="page">
      <div className="toolbar toolbar--start">
        <h1 className="page-title">{'Студенты'}</h1>
      </div>

      <div className="toolbar">
        <div className="toolbar__filters">
          {isAdmin && (
            <select
              className="input"
              value={mine ? '' : teacherId}
              disabled={mine}
              onChange={e => setTeacherId(e.target.value)}
            >
              <option value="">{'Препод — все'}</option>
              {teacherOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          <select className="input" value={courseId} onChange={e => { setCourseId(e.target.value); setGroupId(''); }}>
            <option value="">{'Тема — все'}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">{'Группа — все'}</option>
            {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="toolbar__filters">
          {isAdmin && (
            <button type="button" className={`tab${mine ? ' tab--active' : ''}`} onClick={handleMineToggle}>
              {'Моё'}
            </button>
          )}
          <select className="input" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="name">{'По имени'}</option>
            <option value="score">{'По успеваемости'}</option>
          </select>
        </div>
      </div>

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Имя'}</th>
              <th>{'Группа'}</th>
              {showTeacherColumn && <th>{'Препод'}</th>}
              <th>{'Средний балл'}</th>
              <th>{'Макс. балл'}</th>
              <th>{'Пропуски'}</th>
              <th>{'Опоздания'}</th>
              <th>{'Контакты'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table__empty">{'Загрузка...'}</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={columnCount} className="table__empty">{'Студентов не найдено'}</td></tr>
            ) : (
              students.map(s => (
                <tr key={s.id}>
                  <td>
                    <button type="button" className="link" onClick={() => handleOpenCard(s.id)}>
                      {s.full_name}
                    </button>
                  </td>
                  <td>{s.groups.map(g => g.name).join(', ') || '—'}</td>
                  {showTeacherColumn && (
                    <td>{[...new Set(s.groups.map(g => g.teacher_name).filter(Boolean))].join(', ') || '—'}</td>
                  )}
                  <td>{s.avg_score ?? '—'}</td>
                  <td>{s.max_score ?? '—'}</td>
                  <td>{s.unexcused_absences}</td>
                  <td>{s.late_count}</td>
                  <td>
                    <StudentContactIcons telegram={s.telegram_username} whatsapp={s.whatsapp} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudentsPage;
