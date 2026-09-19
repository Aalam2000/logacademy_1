import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import LanguageSwitcher from '../components/LanguageSwitcher';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const roleBadgeClass = user?.role
    ? `badge badge--role badge--inline badge--${user.role}`
    : '';

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="dashboard-layout">
      <Navigation user={user} isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Оверлей: виден только на мобильном, когда сайдбар открыт.
          Клик по нему закрывает сайдбар. На десктопе не отображается. */}
      {sidebarOpen && (
        <div className="dashboard-overlay" onClick={closeSidebar} />
      )}

      <div className="dashboard-content">
        <div className="dashboard-header">
          {/* Гамбургер: виден только на мобильном (CSS-класс .dashboard-burger) */}
          <button
            type="button"
            className="dashboard-burger"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Меню"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <h2>
            {`Добро пожаловать, ${user?.username || ''}!`}
            {user?.role && (
              <span className={roleBadgeClass}>{user.role}</span>
            )}
          </h2>
          <div className="dashboard-header-right">
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