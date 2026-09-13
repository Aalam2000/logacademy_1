import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation({ user }) {
  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <img src="/assets/logo.svg" alt="Log Academy" width="120" height="40" />
      </div>
      <ul style={styles.list}>
        <li style={styles.item}>
          <NavLink
            to="/dashboard"
            end
            style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}
          >
            📊 {'Главная'}
          </NavLink>
        </li>
        {user?.role !== 'student' && (
          <li style={styles.item}>
            <NavLink
              to="/dashboard/cards"
              style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}
            >
              🃏 {'Квизы'}
            </NavLink>
          </li>
        )}
        <li style={styles.item}>
          <NavLink to="/dashboard/profile"
            style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
            👤 {'Профиль'}
          </NavLink>
        </li>
        {user?.role === 'admin' && (
          <li style={styles.item}>
            <NavLink
              to="/dashboard/admin"
              style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}
            >
              ⚙️ {'Админ'}
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}

const styles = {
  nav: {
    width: '240px',
    height: '100vh',
    background: '#ffffff',
    borderRight: '2px solid #c8f0ea',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logo: {
    padding: '0 20px 30px 20px',
    borderBottom: '1px solid #c8f0ea',
    marginBottom: '20px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  item: {
    margin: '0',
  },
  link: {
    display: 'block',
    padding: '12px 20px',
    color: '#1a2e4a',
    textDecoration: 'none',
    fontSize: '1rem',
    transition: 'background 0.2s',
  },
  active: {
    background: '#c8f0ea',
    fontWeight: 'bold',
    borderRight: '4px solid #3dbdaa',
  },
};

export default Navigation;