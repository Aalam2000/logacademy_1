// Персональный урок: урок группы, который видят и в котором учитываются только
// выбранные ученики (правила — backend/app/personal.py).
//   <PersonalBadge lesson={l} />                      — метка «👤 имена» рядом с названием урока
//   <ParticipantsPicker groupId value onChange />     — выбор учеников группы галочками
//   <ParticipantsModal lesson onClose onSaved />      — смена состава участников (страница урока)
import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { getGroupStudents } from '../api/groups';
import { setLessonParticipants } from '../api/lessons';
import { extractErrorMessage } from '../utils/errors';

export function PersonalBadge({ lesson, onClick }) {
  if (!lesson?.is_personal) return null;
  const names = (lesson.participants || []).map(p => p.full_name).join(', ');
  const className = `badge badge--personal badge--inline${onClick ? ' badge--clickable' : ''}`;
  const content = <>{'👤'}{names ? ` ${names}` : ''}</>;
  return onClick
    ? <button type="button" className={className} data-tip="Персональный урок — изменить участников" onClick={onClick}>{content}</button>
    : <span className={className} data-tip="Персональный урок">{content}</span>;
}

export function ParticipantsPicker({ groupId, value, onChange }) {
  const [students, setStudents] = useState(null); // null — загрузка
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getGroupStudents(groupId, 'active')
      .then(list => { if (alive) setStudents(list); })
      .catch(err => { if (alive) setError(extractErrorMessage(err, 'Не удалось загрузить учеников')); });
    return () => { alive = false; };
  }, [groupId]);

  const toggle = (id) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  if (error) return <div className="form-field__error">{error}</div>;
  if (!students) return <div className="text-muted">{'Загрузка...'}</div>;
  if (students.length === 0) return <div className="text-muted">{'В группе нет учеников'}</div>;
  return (
    <div className="check-list">
      {students.map(st => (
        <label key={st.id} className="check-list__item">
          <input type="checkbox" checked={value.includes(st.id)} onChange={() => toggle(st.id)} />
          <span>{st.full_name || st.username}</span>
        </label>
      ))}
    </div>
  );
}

export function ParticipantsModal({ lesson, onClose, onSaved }) {
  const [ids, setIds] = useState(() => (lesson.participants || []).map(p => p.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (ids.length === 0) { setError('Выберите хотя бы одного ученика'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await setLessonParticipants(lesson.id, ids);
      onSaved(updated);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={'Участники персонального урока'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>{'Отмена'}</button>
          <button type="button" className="btn" onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      )}
    >
      <div className="form-stack">
        <ParticipantsPicker groupId={lesson.group_id} value={ids} onChange={setIds} />
        {error && <div className="form-field__error">{error}</div>}
      </div>
    </Modal>
  );
}
