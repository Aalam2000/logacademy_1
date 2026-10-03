// Роутер /students (backend/app/routers/students.py)
import api from './auth';

// Смена пароля ученика педагогом/админом — без старого пароля.
// Педагог — только ученикам своих групп (проверка на бэкенде).
export function setStudentPassword(studentId, newPassword) {
  return api.put(`/students/${studentId}/password`, { new_password: newPassword });
}
