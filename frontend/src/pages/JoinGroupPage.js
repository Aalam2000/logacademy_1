import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function JoinGroupPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [group, setGroup] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [groupError, setGroupError] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingGroup(true);
      setGroupError('');
      try {
        const res = await api.get(`/groups/invite/${inviteCode}`);
        setGroup(res.data);
      } catch (err) {
        setGroupError(err?.response?.data?.detail || t('join_invalid', 'Приглашение недействительно'));
      } finally {
        setLoadingGroup(false);
      }
    };
    load();
  }, [inviteCode, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await api.post('/auth/register/student', {
        username,
        password,
        full_name: fullName || null,
        invite_code: inviteCode,
      });
      // Успех — на логин с автозаполнением логина
      navigate('/login', { state: { username } });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 400) {
        setSubmitError(t('join_user_exists', 'Пользователь с таким логином уже существует'));
      } else if (err?.response?.status === 404) {
        setSubmitError(t('join_invalid', 'Приглашение недействительно'));
      } else {
        setSubmitError(detail || t('join_error', 'Не удалось зарегистрироваться'));
      }
      setIsSubmitting(false);
    }
  };

  if (loadingGroup) {
    return <div style={s.wrap}>{t('loading', 'Загрузка...')}</div>;
  }

  if (groupError) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <h2 style={s.title}>{t('join_title', 'Регистрация ученика')}</h2>
          <p style={s.error}>{groupError}</p>
          <Link to="/login" style={s.link}>{t('join_to_login', 'Перейти ко входу')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <img src="/assets/logo.svg" alt="Log Academy" width="180" height="60" />
        <h2 style={s.title}>{t('join_title', 'Регистрация ученика')}</h2>
        <p style={s.groupInfo}>
          {t('join_group_label', 'Группа')}: <b>{group?.name}</b>
          {group?.course_title && <> · {group.course_title}</>}
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <input
            style={s.input}
            type="text"
            placeholder={t('join_full_name', 'Имя и фамилия')}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
          <input
            style={s.input}
            type="text"
            placeholder={t('login_username', 'Логин')}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            style={s.input}
            type="password"
            placeholder={t('login_password', 'Пароль')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button style={s.btn} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving', 'Отправка...') : t('join_submit', 'Зарегистрироваться')}
          </button>
        </form>

        {submitError && <p style={s.error}>{submitError}</p>}

        <Link to="/login" style={s.link}>
          {t('join_have_account', 'Уже есть аккаунт? Войти')}
        </Link>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0fafa', padding: '1rem' },
  card: { background: 'white', padding: '40px', borderRadius: '28px', boxShadow: '0 4px 32px rgba(61,189,170,0.08)', textAlign: 'center', border: '2px solid #c8f0ea', maxWidth: '420px', width: '100%' },
  title: { margin: '1rem 0 0.5rem 0' },
  groupInfo: { color: '#4B5563', fontSize: '0.95rem', marginBottom: '1.25rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '12px', borderRadius: '12px', border: '2px solid #c8f0ea', fontSize: '1rem' },
  btn: { background: '#3dbdaa', color: 'white', border: 'none', padding: '12px', borderRadius: '20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  error: { color: '#e05050', marginTop: '0.75rem', fontSize: '0.9rem' },
  link: { display: 'inline-block', marginTop: '1rem', color: '#2E5FA3', fontSize: '0.9rem', textDecoration: 'none' },
};

export default JoinGroupPage;