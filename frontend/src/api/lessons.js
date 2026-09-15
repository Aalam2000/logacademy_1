// Роутер /lessons (backend/app/routers/lessons.py)
import api from './auth';

export function getMyLessons() {
  return api.get('/lessons/my').then(res => res.data);
}

export function getStudentLessons() {
  return api.get('/lessons/student').then(res => res.data);
}

export function getLesson(id) {
  return api.get(`/lessons/${id}`).then(res => res.data);
}

export function createLesson(payload) {
  return api.post('/lessons/', payload).then(res => res.data);
}

export function updateLesson(id, payload) {
  return api.patch(`/lessons/${id}`, payload).then(res => res.data);
}

export function openLesson(id) {
  return api.patch(`/lessons/${id}/open`).then(res => res.data);
}

export function deleteLesson(id) {
  return api.delete(`/lessons/${id}`).then(res => res.data);
}

export function getLessonMarks(lessonId) {
  return api.get(`/lessons/${lessonId}/marks`).then(res => res.data);
}

export function saveLessonMark(lessonId, studentId, payload) {
  return api.put(`/lessons/${lessonId}/marks/${studentId}`, payload).then(res => res.data);
}

export function saveLessonMarksBulk(lessonId, items) {
  return api.put(`/lessons/${lessonId}/marks`, items).then(res => res.data);
}
