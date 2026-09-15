// Роутер /admin (backend/app/routers/admin.py)
import api from './auth';

export function getTeachers() {
  return api.get('/admin/teachers').then(res => res.data);
}

export function createTeacher(data) {
  return api.post('/admin/teachers', data).then(res => res.data);
}

export function deleteTeacher(id) {
  return api.delete(`/admin/teachers/${id}`).then(res => res.data);
}

export function getAdmins() {
  return api.get('/admin/admins').then(res => res.data);
}

export function createAdmin(data) {
  return api.post('/admin/admins', data).then(res => res.data);
}

export function deleteAdmin(id) {
  return api.delete(`/admin/admins/${id}`).then(res => res.data);
}

export function getCourses() {
  return api.get('/admin/courses').then(res => res.data);
}

export function createCourse(data) {
  return api.post('/admin/courses', data).then(res => res.data);
}

export function deleteCourse(id) {
  return api.delete(`/admin/courses/${id}`).then(res => res.data);
}

export function getGroups() {
  return api.get('/admin/groups').then(res => res.data);
}

export function createGroup(data) {
  return api.post('/admin/groups', data).then(res => res.data);
}

export function deleteGroup(id) {
  return api.delete(`/admin/groups/${id}`).then(res => res.data);
}

export function updateGroup(id, data) {
  return api.patch(`/admin/groups/${id}`, data).then(res => res.data);
}
