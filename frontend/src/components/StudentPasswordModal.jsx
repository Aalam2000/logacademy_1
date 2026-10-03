// Смена пароля ученика педагогом (ученик забыл пароль): педагог вводит
// новый пароль сам и сообщает его ученику. Пароль виден при вводе —
// как и при регистрации ученика педагогом (QRModal.jsx).
// PUT /students/{id}/password, права проверяет бэкенд.
import React, { useState } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { setStudentPassword } from '../api/students';
import { extractErrorMessage } from '../utils/errors';

function StudentPasswordModal({ student, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setError('Введите новый пароль'); return; }
    setSaving(true);
    setError('');
    try {
      await setStudentPassword(student.id, password);
      setSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сменить пароль'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={'Смена пароля ученика'}
      onClose={onClose}
      footer={saved ? undefined : (
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>{'Отмена'}</button>
          <button type="submit" form="student-password-form" className="btn" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      )}
    >
      {saved ? (
        <div className="form-stack">
          <div className="meta-row"><b>{student.full_name}</b></div>
          <div>{'Пароль изменён. Сообщите ученику новый пароль'}:</div>
          <div><b>{password}</b></div>
        </div>
      ) : (
        <form id="student-password-form" onSubmit={save} className="form-stack">
          <div className="meta-row"><b>{student.full_name}</b></div>
          <FormField
            label={'Новый пароль'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {error && <div className="form-field__error">{error}</div>}
        </form>
      )}
    </Modal>
  );
}

export default StudentPasswordModal;
