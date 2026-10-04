// Смена пароля пользователю без старого пароля: пользователь забыл пароль —
// педагог (своему ученику) или админ (кому угодно) вводит новый и сообщает
// его. Пароль виден при вводе — как при регистрации ученика педагогом
// (QRModal.jsx). Кто и кому может менять — проверяет бэкенд.
//
// <PasswordModal user={{ id, full_name }} save={(password) => Promise} onClose={...} />
import React, { useState } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { extractErrorMessage } from '../utils/errors';

function PasswordModal({ user, save, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setError('Введите новый пароль'); return; }
    setSaving(true);
    setError('');
    try {
      await save(password);
      setSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сменить пароль'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={'Смена пароля'}
      onClose={onClose}
      footer={saved ? undefined : (
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>{'Отмена'}</button>
          <button type="submit" form="password-form" className="btn" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      )}
    >
      {saved ? (
        <div className="form-stack">
          <div className="meta-row"><b>{user.full_name || user.username}</b></div>
          <div>{'Пароль изменён. Сообщите пользователю новый пароль'}:</div>
          <div><b>{password}</b></div>
        </div>
      ) : (
        <form id="password-form" onSubmit={submit} className="form-stack">
          <div className="meta-row"><b>{user.full_name || user.username}</b></div>
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

export default PasswordModal;
