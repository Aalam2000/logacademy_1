import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import LanguageSwitcher from '../components/LanguageSwitcher';
import StudentStars from '../components/StudentStars';
import { usePresencePing } from '../hooks/usePresencePing';
import { getHomeworkToReview } from '../api/groups';

const HOMEWORK_FLAG_REFRESH_MS = 60 * 1000;

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  usePresencePing(user); // учёт времени в системе (отчёт «Посещения» у админа)

  // Флаг «Проверь ДЗ» у педагога: обновляется при переходе между страницами и раз в минуту
  const { pathname } = useLocation();
  const isTeaching = user?.role === 'teacher' || user?.role === 'admin';
  const [homework, setHomework] = useState({ count: 0, lesson_id: null });
  useEffect(() => {
    if (!isTeaching) return undefined;
    let alive = true;
    const load = () => getHomeworkToReview().then(data => { if (alive) setHomework(data); }).catch(() => {});
    load();
    const timer = setInterval(load, HOMEWORK_FLAG_REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [isTeaching, pathname]);

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

          <div className="dashboard-header-left">
            <h2>
              {/* На телефоне остаётся только имя и роль — приветствие скрыто (.greeting__text, media.css) */}
              <span className="greeting__text">{'Добро пожаловать'}{', '}</span>
              {user?.username || ''}
              <span className="greeting__text">{'!'}</span>
              {user?.role && (
                <span className={roleBadgeClass}>{user.role}</span>
              )}
            </h2>
            {/* Только у студента и только когда звёзды есть */}
            <StudentStars user={user} />
          </div>
          <div className="dashboard-header-right">
            {isTeaching && homework.count > 0 && homework.lesson_id && (
              <button
                type="button"
                className="btn btn--attention"
                data-tip="Есть непроверенные решения ДЗ"
                onClick={() => navigate(`/dashboard/lessons/${homework.lesson_id}`)}
              >
                {/* На телефоне в шапке тесно — остаётся «ДЗ» и число (media.css) */}
                <span className="only-desktop">{'Проверь ДЗ'}</span>
                <span className="only-mobile">{'ДЗ'}</span>
                <span className="btn__count">{homework.count}</span>
              </button>
            )}
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