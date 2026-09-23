// Роутер /lessons (backend/app/routers/lessons.py)
import api from './auth';

// params (только имеют смысл для admin, см. backend): {teacher_id?, mine?}
export function getMyLessons(params) {
  return api.get('/lessons/my', { params }).then(res => res.data);
}

export function getGroupLessons(groupId) {
  return api.get(`/lessons/group/${groupId}`).then(res => res.data);
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

// Генератор расписания группы — см. claude/group-schedule-plan.md.
// payload: {group_id, start_date, start_time, weekdays, lesson_count,
// fill_source?, fill_group_id?}
export function generateSchedule(payload) {
  return api.post('/lessons/generate', payload).then(res => res.data);
}

// Дозаполнение/обновление материалов уже существующих уроков — и как шаг
// после генерации, и как отдельная кнопка «Обновить материалы».
// payload: {source, fill_group_id?, range_from, range_to, mode}
export function fillGroupSchedule(groupId, payload) {
  return api.post(`/lessons/group/${groupId}/fill-schedule`, payload).then(res => res.data);
}

// Удалить все уроки группы разом — шаг «удалить и пересоздать» в диалоге
// генератора, когда в группе уже есть уроки.
export function deleteGroupLessons(groupId) {
  return api.delete(`/lessons/group/${groupId}`).then(res => res.data);
}

// «Праздник» — сдвигает даты этого и всех последующих уроков серии на
// одну позицию вперёд (материалы/оценки не трогает). Работает только
// внутри этой группы, справочника праздников в системе нет.
export function markLessonHoliday(lessonId) {
  return api.post(`/lessons/${lessonId}/mark-holiday`).then(res => res.data);
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
