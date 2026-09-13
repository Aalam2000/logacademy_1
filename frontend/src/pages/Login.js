import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/auth';

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
      const res = await api.post('/auth/login', { username, password });
      const token = res.data.access_token;
      login(token);
      navigate('/dashboard');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка соединения с сервером');
      }
    }
  };

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#f0fafa'}}>
      <div style={{background:'white',padding:'40px',borderRadius:'28px',boxShadow:'0 4px 32px rgba(61,189,170,0.08)',textAlign:'center',border:'2px solid #c8f0ea'}}>
        <img src="/assets/logo.svg" alt="Log Academy" width="200" height="66" />
        <form style={{display:'flex',flexDirection:'column',gap:'1rem',width:'280px',marginTop:'1.5rem'}} onSubmit={handleSubmit}>
          <input style={{padding:'12px',borderRadius:'12px',border:'2px solid #c8f0ea',fontSize:'1rem'}} type="text" placeholder={'Логин'} value={username} onChange={e=>setUsername(e.target.value)} required />
          <input style={{padding:'12px',borderRadius:'12px',border:'2px solid #c8f0ea',fontSize:'1rem'}} type="password" placeholder={'Пароль'} value={password} onChange={e=>setPassword(e.target.value)} required />
          <button style={{background:'#3dbdaa',color:'white',border:'none',padding:'12px',borderRadius:'20px',fontSize:'1.2rem',fontWeight:'bold',cursor:'pointer'}} type="submit">{'Войти'}</button>
        </form>
        {error && <p style={{color:'#e05050', marginTop:'0.5rem'}}>{error}</p>}
      </div>
    </div>
  );
}
export default Login;