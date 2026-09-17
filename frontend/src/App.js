import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddQuizPage from './pages/AddQuizPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import ProfilePage from './pages/ProfilePage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import GroupPage from './pages/GroupPage';
import StudentsPage from './pages/StudentsPage';
import TeachersDirectoryPage from './pages/TeachersDirectoryPage';
import JoinGroupPage from './pages/JoinGroupPage';
import QuizLiveHostPage from './pages/QuizLiveHostPage';
import QuizLiveJoinPage from './pages/QuizLiveJoinPage';
import NotFoundPage from './pages/NotFoundPage';
import RoleRoute from './components/RoleRoute';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join/:inviteCode" element={<JoinGroupPage />} />
        <Route path="/quiz-live/:code" element={<QuizLiveJoinPage />} />
        <Route path="/quiz-live/:code/host" element={
          <PrivateRoute>
            <RoleRoute roles={['teacher', 'admin']}><QuizLiveHostPage /></RoleRoute>
          </PrivateRoute>
        } />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }>
          <Route index element={<HomePage />} />
          <Route path="add-quiz" element={
            <RoleRoute roles={['teacher', 'admin']}><AddQuizPage /></RoleRoute>
          } />
          <Route path="add-quiz/:id" element={
            <RoleRoute roles={['teacher', 'admin']}><AddQuizPage /></RoleRoute>
          } />
          <Route path="materials" element={
            <RoleRoute roles={['teacher', 'admin']}><KnowledgeBasePage /></RoleRoute>
          } />
          <Route path="students" element={
            <RoleRoute roles={['teacher', 'admin']}><StudentsPage /></RoleRoute>
          } />
          <Route path="teachers" element={
            <RoleRoute roles={['admin']}><TeachersDirectoryPage /></RoleRoute>
          } />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={
            <RoleRoute roles={['admin']}><AdminPage /></RoleRoute>
          } />
          <Route path="lessons/:lessonId" element={
            <RoleRoute roles={['teacher', 'admin']}><LessonPage /></RoleRoute>
          } />
          <Route path="groups/:groupId" element={
            <RoleRoute roles={['teacher', 'admin']}><GroupPage /></RoleRoute>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;