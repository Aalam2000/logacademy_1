// Роутер /quizzes (backend/app/routers/quizzes.py)
import api from './auth';

export function getQuizzes() {
  return api.get('/quizzes/').then(res => res.data);
}

export function getQuizForEdit(id) {
  return api.get(`/quizzes/${id}/edit`).then(res => res.data);
}

export function getQuizHtml(id) {
  return api.get(`/quizzes/${id}/html`).then(res => res.data);
}

export function createQuiz(payload) {
  return api.post('/quizzes/', payload).then(res => res.data);
}

export function updateQuiz(id, payload) {
  return api.put(`/quizzes/${id}`, payload).then(res => res.data);
}

export function deleteQuiz(id) {
  return api.delete(`/quizzes/${id}`).then(res => res.data);
}
