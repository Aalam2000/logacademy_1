import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CardsPage from './pages/CardsPage';
import AddQuizPage from './pages/AddQuizPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useI18n } from './context/I18nContext';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function App() {
  const { t } = useI18n();

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }>
          <Route index element={
            <div style={{padding: '2rem', textAlign: 'center', fontSize: '1.2rem', color: '#1a2e4a'}}>
              {t('dashboard_welcome_description', 'Log Academy — платформа для создания и проведения интерактивных квизов. Выберите раздел, чтобы начать работу')}
            </div>
          } />
          <Route path="cards" element={<CardsPage />} />
          <Route path="add-quiz" element={<AddQuizPage />} />
          <Route path="add-quiz/:id" element={<AddQuizPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;