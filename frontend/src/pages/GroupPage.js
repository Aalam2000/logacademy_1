import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';
import Modal from '../components/Modal';
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

  if (loading) return <div className="page page--group">{'Загрузка...'}</div>;

  if (!group) {
    return (
      <div className="page page--group">
        <button className="btn btn--outline" onClick={() => navigate('/dashboard')}>
          {'Назад'}
        </button>
        <div className="error-text error-text--muted">
          {'Группа не найдена'}
        </div>
      </div>
    );
  }

  return (
    <div className="page page--group">
      <button className="btn btn--outline" onClick={() => navigate('/dashboard')}>
        {'Назад'}
      </button>

      {/* Шапка группы */}
      <div className="group-header">
        <div>
          <h2 className="group-header__title">{group.name}</h2>
          <div className="meta-row">
            <span>{'Курс'}: <b>{courseName}</b></span>
            <span>·</span>
            <span>{'Преподаватель'}: <b>{group.teacher_name || '—'}</b></span>
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--info btn--compact" onClick={() => setIsQRModalOpen(true)}>
            {'QR для регистрации'}
          </button>
          <button className="btn btn--compact" onClick={() => setIsStudentsModalOpen(true)}>
            {'Ученики'} ({group.student_count ?? 0})
          </button>
        </div>
      </div>

      {/* Тулбар уроков */}
      <div className="toolbar">
        <h3 className="toolbar__title">{'Уроки'}</h3>
        <button className="btn" onClick={openCreateModal}>
          {'+ Урок'}
        </button>
      </div>

      {error && <div className="error-text error-text--top">{error}</div>}

      {/* Таблица уроков */}
      <table className="table">
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
              <td colSpan={3} className="table__empty">
                {'Уроков нет'}
              </td>
            </tr>
          )}
          {visible.map(l => {
            const today = isToday(l.date);
            return (
              <tr
                key={l.id}
                className={`table__row--clickable${today ? ' table__row--today' : ''}`}
                onClick={() => navigate(`/dashboard/lessons/${l.id}`)}
              >
                <td>
                  {l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}
                  {today && <span className="badge badge--today badge--inline">{'Сегодня'}</span>}
                </td>
                <td>{l.title}</td>
                <td>
                  <span className={`badge ${l.is_open ? 'badge--open' : 'badge--closed'}`}>
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
        <Modal
          title={'Новый урок'}
          onClose={closeCreateModal}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={closeCreateModal}>
                {'Отмена'}
              </button>
              <button type="submit" form="new-lesson-form" className="btn" disabled={isCreating}>
                {isCreating ? 'Сохранение...' : 'Создать'}
              </button>
            </>
          )}
        >
          <form id="new-lesson-form" onSubmit={handleCreateLesson} className="form-stack">
            <label className="field-label">
              {'Дата и время начала'}
              <input
                type="datetime-local"
                className="input"
                value={newLessonDate}
                onChange={e => setNewLessonDate(e.target.value)}
                required
              />
            </label>

            {createError && <div className="form-field__error">{createError}</div>}
          </form>
        </Modal>
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

export default GroupPage;
