import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import Navigation from '../components/Navigation';
import LanguageSwitcher from '../components/LanguageSwitcher';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div style={styles.layout}>
      <Navigation user={user} />
      <div style={styles.content}>
        <div style={styles.header}>
          <h2>
            {t('dashboard_welcome', 'Добро пожаловать, {username}!').replace('{username}', user?.username || '')}
            {user?.role && (
              <span style={{
                marginLeft: '12px',
                fontSize: '0.65rem',
                fontWeight: '600',
                padding: '3px 10px',
                borderRadius: '12px',
                background: user.role === 'admin' ? '#e05050' : user.role === 'teacher' ? '#2E5FA3' : '#3B6D11',
                color: 'white',
                verticalAlign: 'middle',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>{user.role}</span>
            )}
          </h2>
          <div style={styles.headerRight}>
            <LanguageSwitcher />
            <button onClick={() => { logout(); navigate('/login'); }} style={styles.logoutBtn}>
              {t('dashboard_logout', 'Выйти')}
            </button>
          </div>
        </div>
        <div style={styles.pageContent}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  layout:     { display: 'flex', minHeight: '100vh', background: '#f0fafa', overflow: 'hidden' },
  content:    { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header:     { padding: '1rem 2rem', background: 'white', borderBottom: '2px solid #c8f0ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' },
  headerRight:{ display: 'flex', alignItems: 'center', gap: '1rem' },
  logoutBtn:  { background: '#e05050', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem' },
  pageContent:{ flex: 1, overflow: 'auto', padding: 0 },
};

export default Dashboard;