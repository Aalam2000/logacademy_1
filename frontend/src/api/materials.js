// Роутер /materials (backend/app/routers/materials.py)
import api from './auth';

export function getMaterials() {
  return api.get('/materials/').then(res => res.data);
}

// templateFields — необязательный {course_id, sector, template_lesson_no},
// проставить их может только admin (см. backend/app/routers/materials.py).
export function uploadMaterial(file, templateFields) {
  const formData = new FormData();
  formData.append('file', file);
  if (templateFields) {
    const { course_id, sector, template_lesson_no } = templateFields;
    if (course_id != null) formData.append('course_id', course_id);
    if (sector != null) formData.append('sector', sector);
    if (template_lesson_no != null) formData.append('template_lesson_no', template_lesson_no);
  }
  return api.post('/materials/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
}

export function downloadMaterial(id) {
  return api.get(`/materials/${id}/download`, { responseType: 'blob' }).then(res => res.data);
}

export function deleteMaterial(id) {
  return api.delete(`/materials/${id}`).then(res => res.data);
}

// Правка тегов шаблона курса / одобрение / блокировка одного файла — admin.
export function updateMaterialTemplate(id, data) {
  return api.patch(`/materials/${id}/template`, data).then(res => res.data);
}

// Массовое одобрение/блокировка всего пакета материалов курса+сектора — admin.
export function bulkUpdateMaterialTemplate(data) {
  return api.patch('/materials/template/bulk', data).then(res => res.data);
}
