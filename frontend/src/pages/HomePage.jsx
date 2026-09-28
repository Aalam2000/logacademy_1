import React from 'react';
import { useAuth } from '../context/AuthContext';
import GroupsPage from './GroupsPage';
import StudentHome from './StudentHome';

function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'student') return <StudentHome />;
  return <GroupsPage />;
}

export default HomePage;