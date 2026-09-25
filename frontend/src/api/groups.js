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

export function getGroupStudents(groupId, status = 'active') {
  return api.get(`/groups/${groupId}/students`, { params: { status } }).then(res => res.data);
}

export function searchAvailableStudents(groupId, q = '') {
  return api.get(`/groups/${groupId}/available-students`, { params: { q } }).then(res => res.data);
}

export function addGroupMember(groupId, studentId) {
  return api.post(`/groups/${groupId}/members`, { student_id: studentId }).then(res => res.data);
}

export function expelGroupMember(groupId, studentId, reason) {
  return api.post(`/groups/${groupId}/members/${studentId}/expel`, { reason }).then(res => res.data);
}

export function restoreGroupMember(groupId, studentId) {
  return api.post(`/groups/${groupId}/members/${studentId}/restore`).then(res => res.data);
}
