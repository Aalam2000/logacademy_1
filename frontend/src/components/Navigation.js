import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation({ user }) {
  const linkClass = ({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`;

  return (
    <nav className="nav">
      <div className="nav__logo">
        <img src="/assets/logo.svg" alt="Log Academy" width="120" height="40" />
      </div>
      <ul className="nav__list">
        <li className="nav__item">
          <NavLink to="/dashboard" end className={linkClass}>
            📊 {'Главная'}
          </NavLink>
        </li>
        {user?.role !== 'student' && (
          <li className="nav__item">
            <NavLink to="/dashboard/materials" className={linkClass}>
              📚 {'База знаний'}
            </NavLink>
          </li>
        )}
        {user?.role !== 'student' && (
          <li className="nav__item">
            <NavLink to="/dashboard/students" className={linkClass}>
              🎓 {'Студенты'}
            </NavLink>
          </li>
        )}
        {user?.role === 'admin' && (
          <li className="nav__item">
            <NavLink to="/dashboard/teachers" className={linkClass}>
              🧑‍🏫 {'Преподы'}
            </NavLink>
          </li>
        )}
        <li className="nav__item">
          <NavLink to="/dashboard/profile" className={linkClass}>
            👤 {'Профиль'}
          </NavLink>
        </li>
        {user?.role === 'admin' && (
          <li className="nav__item">
            <NavLink to="/dashboard/admin" className={linkClass}>
              ⚙️ {'Админ'}
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default Navigation;
