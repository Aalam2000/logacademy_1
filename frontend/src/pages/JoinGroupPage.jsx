import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/auth';

function JoinGroupPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();

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
        setGroupError(err?.response?.data?.detail || 'Приглашение недействительно');
      } finally {
        setLoadingGroup(false);
      }
    };
    load();
  }, [inviteCode]);

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
        setSubmitError('Пользователь с таким логином уже существует');
      } else if (err?.response?.status === 404) {
        setSubmitError('Приглашение недействительно');
      } else {
        setSubmitError(detail || 'Не удалось зарегистрироваться');
      }
      setIsSubmitting(false);
    }
  };

  if (loadingGroup) {
    return <div className="centered-page">{'Загрузка...'}</div>;
  }

  if (groupError) {
    return (
      <div className="centered-page">
        <div className="card">
          <h2 className="card__title">{'Регистрация ученика'}</h2>
          <p className="error-text error-text--sm">{groupError}</p>
          <Link to="/login" className="link link--block">{'Перейти ко входу'}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-page">
      <div className="card">
        <img src="/assets/logo.svg" alt="Log Academy" width="180" height="60" />
        <h2 className="card__title">{'Регистрация ученика'}</h2>
        <p className="card__meta">
          {'Группа'}: <b>{group?.name}</b>
          {group?.course_title && <> · {group.course_title}</>}
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <input
            className="input input--lg"
            type="text"
            placeholder={'Имя и фамилия'}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
          <input
            className="input input--lg"
            type="text"
            placeholder={'Логин'}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            className="input input--lg"
            type="password"
            placeholder={'Пароль'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="btn btn--pill btn--lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Отправка...' : 'Зарегистрироваться'}
          </button>
        </form>

        {submitError && <p className="error-text error-text--sm">{submitError}</p>}

        <Link to="/login" className="link link--block">
          {'Уже есть аккаунт? Войти'}
        </Link>
      </div>
    </div>
  );
}

export default JoinGroupPage;
