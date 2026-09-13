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
    <div style={s.row}>
      <label style={s.label}>{label}</label>
      <input style={s.input} type={type} autoComplete="new-password"
        value={form[field]}
        onChange={e => setForm({ ...form, [field]: e.target.value })}
      />
    </div>
  );

  return (
    <div style={s.wrap}>
      <h2>{'Мой профиль'}</h2>

      <div style={s.row}>
        <label style={s.label}>{'Логин'}</label>
        <span style={s.readonly}>{username} <span style={{...s.badge, background: role === 'admin' ? '#e05050' : role === 'teacher' ? '#2E5FA3' : '#3B6D11'}}>{role}</span></span>
      </div>

      {f('full_name',         'Полное имя')}
      {f('email',             'Email')}
      {f('phone',             'Телефон')}
      {f('telegram_username', 'Telegram')}
      {f('whatsapp',          'WhatsApp')}

      <hr style={s.hr}/>
      <h3>{'Смена пароля'}</h3>
      {f('old_password', 'Текущий пароль', 'password')}
      {f('new_password', 'Новый пароль',   'password')}

      {msg   && <div style={s.success}>{msg}</div>}
      {error && <div style={s.error}>{error}</div>}

      <button style={s.btn} onClick={save}>{'Сохранить'}</button>
    </div>
  );
}

const s = {
  wrap:     { padding: '2rem', maxWidth: '480px' },
  row:      { display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px' },
  label:    { width: '160px', fontSize: '0.9rem', color: '#1a2e4a', flexShrink: 0 },
  input:    { flex: 1, padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem' },
  readonly: { flex: 1, padding: '8px 0', fontSize: '0.9rem', color: '#6B7280' },
  badge:    { marginLeft: '8px', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#2E5FA3', color: 'white', textTransform: 'uppercase' },
  hr:       { border: 'none', borderTop: '1px solid #c8f0ea', margin: '20px 0' },
  btn:      { padding: '10px 28px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' },
  success:  { background: '#d4edda', color: '#155724', padding: '8px 14px', borderRadius: '8px', marginBottom: '12px' },
  error:    { background: '#fde8e8', color: '#c0392b', padding: '8px 14px', borderRadius: '8px', marginBottom: '12px' },
};

export default ProfilePage;