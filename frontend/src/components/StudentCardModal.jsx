// Карточка ученика: все его данные в одном окне — для админа (секретаря) и
// педагога (только ученики своих групп, проверка на бэкенде).
//   <StudentCardModal studentId={id} onClose onSaved />        — правка
//   <StudentCardModal groups={[{id, name}]} onClose onSaved />   — новый ученик сразу в группу
// Телефон ученика: обязателен, в базе не повторяется. Телефон родителя
// повторяться может (братья и сёстры). Правила — backend/app/phones.py.
import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { getStudentProfile, updateStudentProfile, createStudent } from '../api/students';
import { PHONE_PLACEHOLDER } from '../utils/phone';

const EMPTY = {
  full_name: '', phone: '', email: '', telegram_username: '', whatsapp: '',
  parent_name: '', parent_phone: '', username: '', password: '', group_id: '',
};

function StudentCardModal({ studentId, groups = [], defaultGroupId = '', onClose, onSaved }) {
  const isNew = !studentId;
  const [draft, setDraft] = useState(isNew ? { ...EMPTY, group_id: defaultGroupId || '' } : null); // null — загрузка
  const [groupNames, setGroupNames] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    getStudentProfile(studentId)
      .then(p => {
        if (!alive) return;
        setGroupNames(p.groups || []);
        setDraft({
          ...EMPTY,
          username: p.username,
          full_name: p.full_name || '', phone: p.phone || '', email: p.email || '',
          telegram_username: p.telegram_username || '', whatsapp: p.whatsapp || '',
          parent_name: p.parent_name || '', parent_phone: p.parent_phone || '',
        });
      })
      .catch(err => { if (alive) setError(err?.response?.data?.detail || 'Не удалось загрузить данные ученика'); });
    return () => { alive = false; };
  }, [studentId, isNew]);

  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (isNew && (!draft.username.trim() || !draft.password || !draft.group_id || !draft.phone.trim())) {
      setError('Заполните логин, пароль, телефон и группу');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { username, password, group_id, ...profile } = draft;
      const saved = isNew
        ? await createStudent({ ...profile, username: username.trim(), password, group_id: Number(group_id) })
        : await updateStudentProfile(studentId, profile);
      onSaved(saved);
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 409
        ? 'Этот телефон ученика уже есть у другого пользователя'
        : (err?.response?.data?.detail || 'Не удалось сохранить'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Новый ученик' : 'Данные ученика'}
      size="wide"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>{'Отмена'}</button>
          <button type="submit" form="student-card-form" className="btn" disabled={!draft || saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      )}
    >
      {!draft && !error && <div className="text-muted">{'Загрузка...'}</div>}
      {draft && (
        <form id="student-card-form" onSubmit={submit} className="form-stack">
          <h4 className="form-section">{'Ученик'}</h4>
          <div className="form-grid">
            <FormField label={'Имя и фамилия'} value={draft.full_name} onChange={set('full_name')} autoFocus />
            <FormField label={'Телефон ученика'} type="tel" placeholder={PHONE_PLACEHOLDER} value={draft.phone} onChange={set('phone')} />
            {isNew ? (
              <>
                <FormField label={'Логин'} value={draft.username} onChange={set('username')} autoComplete="off" />
                <FormField label={'Пароль'} value={draft.password} onChange={set('password')} autoComplete="off" />
              </>
            ) : (
              <FormField label={'Логин'}><span className="readonly-text">{draft.username}</span></FormField>
            )}
            <FormField label={'Email'} type="email" value={draft.email} onChange={set('email')} />
            <FormField label={'Telegram'} value={draft.telegram_username} onChange={set('telegram_username')} />
            <FormField label={'WhatsApp'} value={draft.whatsapp} onChange={set('whatsapp')} />
          </div>

          <h4 className="form-section">{'Родитель'}</h4>
          <div className="form-grid">
            <FormField label={'Имя родителя'} value={draft.parent_name} onChange={set('parent_name')} />
            <FormField label={'Телефон родителя'} type="tel" placeholder={PHONE_PLACEHOLDER} value={draft.parent_phone} onChange={set('parent_phone')} />
          </div>

          <h4 className="form-section">{'Группа'}</h4>
          {isNew ? (
            <select className="input" value={draft.group_id} onChange={set('group_id')}>
              <option value="">{'Выберите группу'}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          ) : (
            <div className="readonly-text">{groupNames.join(', ') || '—'}</div>
          )}
          <div className="hint-text">
            {'Если у ребёнка нет своего телефона, в оба поля впишите телефон родителя. Номер можно вводить как +994 50 123 45 67 или 050 123 45 67.'}
          </div>
        </form>
      )}
      {error && <div className="form-field__error">{error}</div>}
    </Modal>
  );
}

export default StudentCardModal;
