import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function StudentsModal({ groupId, groupName, onClose }) {
  const { t } = useI18n();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/groups/${groupId}/students`);
        setStudents(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || t('students_load_error', 'Не удалось загрузить учеников'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, t]);

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.title}>
          {t('group_students_btn', 'Ученики')} — {groupName}
        </h3>

        {loading && <p style={s.info}>{t('loading', 'Загрузка...')}</p>}
        {error && <p style={s.error}>{error}</p>}

        {!loading && !error && (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('student_name', 'Имя')}</th>
                <th style={s.th}>{t('login_username', 'Логин')}</th>
                <th style={s.th}>{t('student_registered', 'Дата регистрации')}</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                    {t('students_empty', 'Учеников пока нет')}
                  </td>
                </tr>
              )}
              {students.map(st => (
                <tr key={st.id} style={s.row}>
                  <td style={s.td}>{st.full_name || '—'}</td>
                  <td style={s.td}>{st.username}</td>
                  <td style={s.td}>{st.created_at ? new Date(st.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={s.actions}>
          <button style={s.closeBtn} onClick={onClose}>
            {t('close', 'Закрыть')}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '100%', maxWidth: '560px', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 12px 32px rgba(0,0,0,0.2)' },
  title: { margin: '0 0 1rem 0' },
  info: { color: '#6B7280', textAlign: 'center', padding: '1rem' },
  error: { color: '#B91C1C', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e8f4f0', color: '#4B5563', fontWeight: 600 },
  td: { padding: '8px 10px', borderBottom: '1px solid #e8f4f0' },
  row: {},
  actions: { marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' },
  closeBtn: { padding: '8px 24px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};

export default StudentsModal;