// Роутер /students (backend/app/routers/students.py)
import api from './auth';

// Смена пароля ученика педагогом/админом — без старого пароля.
// Педагог — только ученикам своих групп (проверка на бэкенде).
export function setStudentPassword(studentId, newPassword) {
  return api.put(`/students/${studentId}/password`, { new_password: newPassword });
}

// Данные ученика для правки: имя, телефон, родитель, телефон родителя.
// Педагог — только своим ученикам, админ — любому (проверка на бэкенде).
export function getStudentProfile(studentId) {
  return api.get(`/students/${studentId}/profile`).then(res => res.data);
}

export function updateStudentProfile(studentId, data) {
  return api.put(`/students/${studentId}/profile`, data).then(res => res.data);
}
