import React from 'react';
import { useAuth } from '../context/AuthContext';
import TeacherHome from './TeacherHome';
import StudentHome from './StudentHome';

function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'student') return <StudentHome />;
  return <TeacherHome />;
}

export default HomePage;