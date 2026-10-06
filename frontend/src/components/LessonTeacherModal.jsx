// Педагог уроков группы — только у админа: замена на один урок, передача
// группы с такого-то урока, указание, кто вёл уроки раньше. Отрезок задаётся
// уроками «с» и «по»; «до конца» делает педагога основным в группе.
// Правила и доступ — backend/app/lesson_teacher.py.
//   <LessonTeacherModal group lessons onSaved onClose />
import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { assignGroupTeacher, getAdmins, getTeachers } from '../api/admin';
import { extractErrorMessage } from '../utils/errors';

// Порядок уроков во времени, как на бэке (lesson_teacher.schedule_key): без даты — в конце
const byschedule = (a, b) => {
  if (!a.date !== !b.date) return a.date ? -1 : 1;
  return (new Date(a.date || 0) - new Date(b.date || 0)) || (a.order - b.order) || (a.id - b.id);
};

function LessonTeacherModal({ group, lessons, onSaved, onClose }) {
  const ordered = useMemo(() => [...lessons].sort(byschedule), [lessons]);
  const [teachers, setTeachers] = useState(null); // null — загрузка
  const [teacherId, setTeacherId] = useState('');
  // По умолчанию — с ближайшего урока (сегодня и дальше)
  const [fromId, setFromId] = useState(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = ordered.find(l => !l.date || new Date(l.date) >= today);
    return String((next || ordered[ordered.length - 1])?.id || '');
  });
  const [toId, setToId] = useState(''); // '' — до конца
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getTeachers(), getAdmins()])
      .then(([list, admins]) => { if (alive) setTeachers([...list, ...admins]); })
      .catch(err => { if (alive) { setTeachers([]); setError(extractErrorMessage(err, 'Не удалось загрузить педагогов')); } });
    return () => { alive = false; };
  }, []);

  const lessonLabel = (l) => {
    const date = l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—';
    return `${date} · ${l.title} — ${l.teacher_name || group.teacher_name || ''}`;
  };
  const fromIndex = ordered.findIndex(l => String(l.id) === fromId);
  const lastOptions = fromIndex < 0 ? [] : ordered.slice(fromIndex);

  const handleFrom = (value) => {
    setFromId(value);
    const index = ordered.findIndex(l => String(l.id) === value);
    // «по» не может оказаться раньше «с»
    if (toId && ordered.findIndex(l => String(l.id) === toId) < index) setToId(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherId) {
      setError('Выберите педагога');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await assignGroupTeacher(group.id, {
        teacher_id: parseInt(teacherId),
        from_lesson_id: parseInt(fromId),
        to_lesson_id: toId ? parseInt(toId) : null,
      });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось назначить педагога'));
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={'Педагог уроков'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            {'Отмена'}
          </button>
          <button type="submit" form="lesson-teacher-form" className="btn" disabled={isSaving || !teachers || !fromId}>
            {isSaving ? 'Сохранение...' : 'Назначить'}
          </button>
        </>
      )}
    >
      {ordered.length === 0 ? (
        <p className="hint-text">{'В группе нет уроков. Педагог группы меняется в её карточке в разделе «Админ».'}</p>
      ) : (
        <form id="lesson-teacher-form" onSubmit={handleSubmit} className="form-stack">
          <label className="field-label">
            {'Педагог'}
            <select className="input" value={teacherId} onChange={e => setTeacherId(e.target.value)} disabled={!teachers}>
              <option value="">{teachers ? 'Выберите педагога' : 'Загрузка...'}</option>
              {(teachers || []).map(t => <option key={t.id} value={t.id}>{t.full_name || t.username}</option>)}
            </select>
          </label>
          <label className="field-label">
            {'С урока'}
            <select className="input" value={fromId} onChange={e => handleFrom(e.target.value)}>
              {ordered.map(l => <option key={l.id} value={l.id}>{lessonLabel(l)}</option>)}
            </select>
          </label>
          <label className="field-label">
            {'По урок'}
            <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
              <option value="">{'до конца — группа переходит к этому педагогу'}</option>
              {lastOptions.map(l => <option key={l.id} value={l.id}>{lessonLabel(l)}</option>)}
            </select>
          </label>
          <p className="hint-text">
            {toId
              ? 'Замена: основной педагог группы не меняется. Назначенный педагог увидит только эти уроки и сможет работать в каждом до полуночи дня урока.'
              : 'Передача: педагог станет основным в группе, получит доступ ко всем её урокам, и новые уроки будут создаваться на него. Прежний педагог сохранит просмотр своих уроков.'}
          </p>
          {error && <div className="form-field__error">{error}</div>}
        </form>
      )}
    </Modal>
  );
}

export default LessonTeacherModal;
