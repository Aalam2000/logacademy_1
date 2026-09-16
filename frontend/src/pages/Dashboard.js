import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleBadgeClass = user?.role
    ? `badge badge--role badge--inline badge--${user.role}`
    : '';

  return (
    <div className="dashboard-layout">
      <Navigation user={user} />
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>
            {`Добро пожаловать, ${user?.username || ''}!`}
            {user?.role && (
              <span className={roleBadgeClass}>{user.role}</span>
            )}
          </h2>
          <div className="dashboard-header-right">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button onClick={() => { logout(); navigate('/login'); }} className="btn btn--danger btn--pill">
              {'Выйти'}
            </button>
          </div>
        </div>
        <div className="dashboard-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
