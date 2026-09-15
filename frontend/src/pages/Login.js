import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginRequest } from '../api/auth';
import { getErrorMessage } from '../api/errors';
import Input from '../components/Input';
import Button from '../components/Button';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState(location.state?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await loginRequest(username, password);
      login(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Ошибка соединения с сервером'));
    }
  };

  return (
    <div className="centered-page">
      <div className="card">
        <img src="/assets/logo.svg" alt="Log Academy" width="200" height="66" />
        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            className="input--lg"
            type="text"
            placeholder={'Логин'}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <Input
            className="input--lg"
            type="password"
            placeholder={'Пароль'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <Button className="btn--pill btn--lg" type="submit">{'Войти'}</Button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default Login;
