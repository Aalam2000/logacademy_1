import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  IconDashboard,
  IconKnowledge,
  IconStudents,
  IconTeachers,
  IconProfile,
  IconAdmin,
  IconPerformance,
  IconHelp,
} from './CyberIcons';
import HelpPanel from './HelpPanel';

function Navigation({ user, isOpen, onClose }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const linkClass = ({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`;

  const handleLinkClick = () => {
    // На мобильном клик по ссылке должен закрывать сайдбар.
    // На десктопе onClose тоже вызовется, но там isOpen не используется —
    // сайдбар всегда виден через CSS, ничего не сломается.
    if (onClose) onClose();
  };

  return (
    <nav className={`nav${isOpen ? ' nav--open' : ''}`}>
      <div className="nav__logo">
        <img src="/assets/logo.svg" alt="Log Academy" width="120" height="40" />
      </div>
      <ul className="nav__list">
        <li className="nav__item">
          <NavLink to="/dashboard" end className={linkClass} onClick={handleLinkClick}>
            <IconDashboard className="nav__icon" />
            <span>{'Главная'}</span>
          </NavLink>
        </li>
        {user?.role === 'student' && (
          <li className="nav__item">
            <NavLink to="/dashboard/performance" className={linkClass} onClick={handleLinkClick}>
              <IconPerformance className="nav__icon" />
              <span>{'Успеваемость'}</span>
            </NavLink>
          </li>
        )}
        {user?.role !== 'student' && (
          <li className="nav__item">
            <NavLink to="/dashboard/materials" className={linkClass} onClick={handleLinkClick}>
              <IconKnowledge className="nav__icon" />
              <span>{'База знаний'}</span>
            </NavLink>
          </li>
        )}
        {user?.role !== 'student' && (
          <li className="nav__item">
            <NavLink to="/dashboard/students" className={linkClass} onClick={handleLinkClick}>
              <IconStudents className="nav__icon" />
              <span>{'Студенты'}</span>
            </NavLink>
          </li>
        )}
        {user?.role === 'admin' && (
          <li className="nav__item">
            <NavLink to="/dashboard/teachers" className={linkClass} onClick={handleLinkClick}>
              <IconTeachers className="nav__icon" />
              <span>{'Учителя'}</span>
            </NavLink>
          </li>
        )}
        <li className="nav__item">
          <NavLink to="/dashboard/profile" className={linkClass} onClick={handleLinkClick}>
            <IconProfile className="nav__icon" />
            <span>{'Профиль'}</span>
          </NavLink>
        </li>
        {user?.role === 'admin' && (
          <li className="nav__item">
            <NavLink to="/dashboard/admin" className={linkClass} onClick={handleLinkClick}>
              <IconAdmin className="nav__icon" />
              <span>{'Админ'}</span>
            </NavLink>
          </li>
        )}
      </ul>
      <button type="button" className="nav__help" onClick={() => setHelpOpen(true)}>
        <IconHelp className="nav__icon" />
        <span>{'Помощь'}</span>
      </button>
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </nav>
  );
}

export default Navigation;