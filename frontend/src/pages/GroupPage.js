import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';
import QRModal from '../components/QRModal';
import StudentsModal from '../components/StudentsModal';

function GroupPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const gid = parseInt(groupId);

  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLessonDate, setNewLessonDate] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [lessonsRes, groupsRes, coursesRes] = await Promise.all([
          api.get('/lessons/my'),
          api.get('/groups/my'),
          api.get('/groups/courses'),
        ]);
        setLessons(lessonsRes.data);
        setGroups(groupsRes.data);
        setCourses(coursesRes.data);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Не удалось загрузить группу');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const group = groups.find(g => g.id === gid);
  const courseName = courses.find(c => c.id === group?.course_id)?.title || '—';

  // Уроки только этой группы, по умолчанию — с сегодня
  const visible = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return lessons
      .filter(l => l.group_id === gid)
      .filter(l => !l.date || new Date(l.date) >= today)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [lessons, gid]);

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  };

  const openCreateModal = () => {
    setCreateError('');
    setNewLessonDate('');
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setCreateError('');
    setIsCreating(false);
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!newLessonDate) {
      setCreateError('Укажите дату и время начала урока');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const payload = {
        group_id: gid,
        title: 'Урок',
        date: new Date(newLessonDate).toISOString(),
      };
      const created = await api.post('/lessons/', payload);
      setLessons(prev => [...prev, created.data]);
      closeCreateModal();
    } catch (err) {
      setCreateError(err?.response?.data?.detail || 'Не удалось создать урок');
      setIsCreating(false);
    }
  };

  if (loading) return <div style={s.wrap}>{'Загрузка...'}</div>;

  if (!group) {
    return (
      <div style={s.wrap}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
          {'Назад'}
        </button>
        <div style={{ marginTop: '1rem', color: '#B91C1C' }}>
          {'Группа не найдена'}
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
        {'Назад'}
      </button>

      {/* Шапка группы */}
      <div style={s.header}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0' }}>{group.name}</h2>
          <div style={s.meta}>
            <span>{'Курс'}: <b>{courseName}</b></span>
            <span>·</span>
            <span>{'Преподаватель'}: <b>{group.teacher_name || '—'}</b></span>
          </div>
        </div>
        <div style={s.headerActions}>
          <button style={s.btnQR} onClick={() => setIsQRModalOpen(true)}>
            {'QR для регистрации'}
          </button>
          <button style={s.btnStudents} onClick={() => setIsStudentsModalOpen(true)}>
            {'Ученики'} ({group.student_count ?? 0})
          </button>
        </div>
      </div>

      {/* Тулбар уроков */}
      <div style={s.toolbar}>
        <h3 style={{ margin: 0 }}>{'Уроки'}</h3>
        <button style={s.btn} onClick={openCreateModal}>
          {'+ Урок'}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* Таблица уроков */}
      <table style={s.table}>
        <thead>
          <tr>
            <th>{'Дата'}</th>
            <th>{'Тема урока'}</th>
            <th>{'Доступ'}</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {'Уроков нет'}
              </td>
            </tr>
          )}
          {visible.map(l => {
            const today = isToday(l.date);
            return (
              <tr
                key={l.id}
                style={{ ...s.row, background: today ? '#FFF3CD' : 'transparent' }}
                onClick={() => navigate(`/dashboard/lessons/${l.id}`)}
              >
                <td>
                  {l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}
                  {today && <span style={s.todayBadge}>{'Сегодня'}</span>}
                </td>
                <td>{l.title}</td>
                <td>
                  <span style={{ ...s.badge, background: l.is_open ? '#3B6D11' : '#6B7280' }}>
                    {l.is_open ? 'Открыт' : 'Закрыт'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Модалка создания урока */}
      {isModalOpen && (
        <div style={s.modalBackdrop}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{'Новый урок'}</h3>
            <form onSubmit={handleCreateLesson} style={s.modalForm}>
              <label style={s.label}>
                {'Дата и время начала'}
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
                  {'Отмена'}
                </button>
                <button type="submit" style={s.btn} disabled={isCreating}>
                  {isCreating ? 'Сохранение...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isQRModalOpen && (
        <QRModal group={group} onClose={() => setIsQRModalOpen(false)} />
      )}

      {isStudentsModalOpen && (
        <StudentsModal
          groupId={gid}
          groupName={group.name}
          onClose={() => setIsStudentsModalOpen(false)}
        />
      )}
    </div>
  );
}

const s = {
  wrap: { padding: '2rem', maxWidth: '960px' },
  backBtn: { padding: '6px 14px', border: '1px solid #c8f0ea', borderRadius: '8px', background: 'white', cursor: 'pointer', marginBottom: '1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  meta: { display: 'flex', gap: '8px', fontSize: '0.9rem', color: '#4B5563' },
  headerActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnQR: { padding: '8px 16px', background: '#2E5FA3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnStudents: { padding: '8px 16px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  btn: { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnSecondary: { padding: '8px 20px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  row: { borderBottom: '1px solid #e8f4f0', cursor: 'pointer' },
  todayBadge: { marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: '#F59E0B', color: 'white', fontSize: '0.7rem', fontWeight: 600 },
  badge: { padding: '2px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 600 },
  error: { color: '#B91C1C', fontSize: '0.85rem', marginBottom: '0.75rem' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '100%', maxWidth: '420px', background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.2)' },
  modalTitle: { margin: '0 0 1rem 0' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '0.8rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem', color: '#111827' },
  input: { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.6rem' },
};

export default GroupPage;