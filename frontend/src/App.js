import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CardsPage from './pages/CardsPage';
import AddQuizPage from './pages/AddQuizPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useI18n } from './context/I18nContext';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import GroupPage from './pages/GroupPage';
import JoinGroupPage from './pages/JoinGroupPage';

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
        <Route path="/join/:inviteCode" element={<JoinGroupPage />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }>
          <Route index element={<HomePage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="add-quiz" element={<AddQuizPage />} />
          <Route path="add-quiz/:id" element={<AddQuizPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="lessons/:lessonId" element={<LessonPage />} />
          <Route path="groups/:groupId" element={<GroupPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;