// Роутер академии (backend/app/routers/academy.py): данные академии и секторы
import api from './auth';

// Название академии — единственное, что доступно без входа
export function getAcademyPublic() {
  return api.get('/academy/public').then(res => res.data);
}

// Секторы: [{code, name, lesson_word}] — для форм группы и Базы знаний
export function getSectors() {
  return api.get('/academy/sectors').then(res => res.data);
}

export function getAcademy() {
  return api.get('/admin/academy').then(res => res.data);
}

export function updateAcademy(data) {
  return api.put('/admin/academy', data).then(res => res.data);
}

// {languages: [...], available: [...]} — языки интерфейса и те из них, у
// которых ещё нет сектора (сектор создаётся только для свободного языка)
export function getSectorLanguages() {
  return api.get('/admin/sector-languages').then(res => res.data);
}

export function createSector(data) {
  return api.post('/admin/sectors', data).then(res => res.data);
}

// Код сектора не меняется — только название и название урока
export function updateSector(code, data) {
  return api.patch(`/admin/sectors/${code}`, data).then(res => res.data);
}

export function deleteSector(code) {
  return api.delete(`/admin/sectors/${code}`).then(res => res.data);
}
