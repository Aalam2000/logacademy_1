// Роутер /groups (backend/app/routers/groups.py)
import api from './auth';

export function getMyGroups() {
  return api.get('/groups/my').then(res => res.data);
}

// Список курсов для регистрации/создания группы — отдельный эндпоинт
// /groups/courses, не путать с admin.getCourses() (/admin/courses).
export function getCourses() {
  return api.get('/groups/courses').then(res => res.data);
}

export function getGroupByInvite(inviteCode) {
  return api.get(`/groups/invite/${inviteCode}`).then(res => res.data);
}

export function getGroupStudents(groupId) {
  return api.get(`/groups/${groupId}/students`).then(res => res.data);
}
