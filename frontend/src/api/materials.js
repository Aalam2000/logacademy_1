// Роутер /materials (backend/app/routers/materials.py)
import api from './auth';

export function getMaterials() {
  return api.get('/materials/').then(res => res.data);
}

export function uploadMaterial(file) {
  const formData = new FormData();
  formData.append('file', file);
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
