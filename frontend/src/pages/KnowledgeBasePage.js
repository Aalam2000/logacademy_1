import React, { useEffect, useRef, useState } from 'react';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function KnowledgeBasePage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/materials/');
      setMaterials(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить базу знаний');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadMaterials();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpen = async (id, contentType) => {
    setError('');
    try {
      const res = await api.get(`/materials/${id}/download`, { responseType: 'blob' });
      const type = res.headers?.['content-type'] || contentType || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type }));
      window.open(url, '_blank');
      // Отзываем ссылку с задержкой — новой вкладке нужно время её открыть
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось открыть файл');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Удалить файл из базы знаний?');
    if (!confirmed) return;

    setDeletingId(id);
    setError('');
    try {
      await api.delete(`/materials/${id}`);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось удалить файл');
    } finally {
      setDeletingId(null);
    }
  };

  const columnCount = isAdmin ? 6 : 5;

  return (
    <div className="page">
      <div className="toolbar toolbar--start">
        <h1 className="page-title">{'База знаний'}</h1>
      </div>

      <div className="form-toolbar">
        <input type="file" ref={fileInputRef} className="input" />
        <button type="button" className="btn" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? 'Загрузка...' : 'Загрузить'}
        </button>
      </div>

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Имя файла'}</th>
              <th>{'Тип'}</th>
              <th>{'Размер'}</th>
              <th>{'Загрузил'}</th>
              <th>{'Дата'}</th>
              {isAdmin && <th>{'Удалить'}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table__empty">{'Загрузка...'}</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan={columnCount} className="table__empty">{'В базе знаний пока нет файлов'}</td></tr>
            ) : (
              materials.map(m => (
                <tr key={m.id}>
                  <td>
                    <button
                      type="button"
                      className="link"
                      onClick={() => handleOpen(m.id, m.content_type)}
                    >
                      {m.original_filename}
                    </button>
                  </td>
                  <td>{m.content_type || '—'}</td>
                  <td className="nowrap">{formatSize(m.size_bytes)}</td>
                  <td>{m.uploaded_by_name || '—'}</td>
                  <td className="nowrap">{new Date(m.created_at).toLocaleDateString('ru-RU')}</td>
                  {isAdmin && (
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default KnowledgeBasePage;
