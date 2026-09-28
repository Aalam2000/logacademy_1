import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/auth';

function ProfilePage() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', telegram_username: '', whatsapp: '',
    old_password: '', new_password: ''
  });
  const [username, setUsername] = useState('');
  const [role, setRole]         = useState('');
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setUsername(r.data.username);
      setRole(r.data.role);
      setForm(f => ({
        ...f,
        full_name:        r.data.full_name || '',
        email:            r.data.email || '',
        phone:            r.data.phone || '',
        telegram_username: r.data.telegram_username || '',
        whatsapp:         r.data.whatsapp || '',
      }));
    });
  }, []);

  const save = async () => {
    try {
      await api.put('/auth/me', form);
      setMsg('Сохранено!');
      refreshUser();
      setError('');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      setError(e.response?.data?.detail || 'Ошибка');
      setMsg('');
    }
  };

  const f = (field, label, type='text') => (
    <div className="form-row">
      <label className="form-row__label">{label}</label>
      <input className="input form-row__value" type={type} autoComplete="new-password"
        value={form[field]}
        onChange={e => setForm({ ...form, [field]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="page page--narrow">
      <h2>{'Мой профиль'}</h2>

      <div className="form-row">
        <label className="form-row__label">{'Логин'}</label>
        <span className="readonly-text">{username} <span className={`badge badge--role badge--inline badge--${role}`}>{role}</span></span>
      </div>

      {f('full_name',         'Полное имя')}
      {f('email',             'Email')}
      {f('phone',             'Телефон')}
      {f('telegram_username', 'Telegram')}
      {f('whatsapp',          'WhatsApp')}

      <hr className="divider"/>
      <h3>{'Смена пароля'}</h3>
      {f('old_password', 'Текущий пароль', 'password')}
      {f('new_password', 'Новый пароль',   'password')}

      {msg   && <div className="banner banner--success">{msg}</div>}
      {error && <div className="banner banner--error">{error}</div>}

      <button className="btn" onClick={save}>{'Сохранить'}</button>
    </div>
  );
}

export default ProfilePage;
