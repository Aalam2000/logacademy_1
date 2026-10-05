import React, { useEffect, useState } from 'react';
import api from '../api/auth';
import { getGroupStudents, searchAvailableStudents, addGroupMember, expelGroupMember, restoreGroupMember } from '../api/groups';
import { getStudentProfile, updateStudentProfile } from '../api/students';
import { PHONE_PLACEHOLDER } from '../utils/phone';

function StudentsModal({ groupId, groupName, onClose }) {
  const [tab, setTab] = useState('active'); // active | archived
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);

  const [expellingId, setExpellingId] = useState(null);
  const [expelReason, setExpelReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Правка данных ученика: имя, телефон, родитель, телефон родителя
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null); // null — ещё загружается
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getGroupStudents(groupId, tab === 'active' ? 'active' : 'expelled');
      setStudents(res);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить учеников');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [groupId, tab]);

  // Поиск учеников для добавления — с задержкой, чтобы не дёргать бэк на
  // каждую букву.
  useEffect(() => {
    if (!showAdd) return;
    setAddLoading(true);
    const t = setTimeout(() => {
      searchAvailableStudents(groupId, addQuery)
        .then(setAddResults)
        .catch(() => setAddResults([]))
        .finally(() => setAddLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [groupId, showAdd, addQuery]);

  const handleAdd = async (studentId) => {
    setAddingId(studentId);
    setError('');
    try {
      await addGroupMember(groupId, studentId);
      setAddResults(prev => prev.filter(s => s.id !== studentId));
      if (tab === 'active') await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось добавить ученика');
    } finally {
      setAddingId(null);
    }
  };

  const handleExpelConfirm = async (studentId) => {
    const reason = expelReason.trim();
    if (!reason) return;
    setBusyId(studentId);
    setError('');
    try {
      await expelGroupMember(groupId, studentId, reason);
      setExpellingId(null);
      setExpelReason('');
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось отчислить');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = async (studentId) => {
    setExpellingId(null);
    setEditingId(studentId);
    setEditDraft(null);
    setEditError('');
    try {
      const p = await getStudentProfile(studentId);
      setEditDraft({
        full_name: p.full_name || '',
        phone: p.phone || '',
        parent_name: p.parent_name || '',
        parent_phone: p.parent_phone || '',
      });
    } catch (err) {
      setEditError(err?.response?.data?.detail || 'Не удалось загрузить данные ученика');
    }
  };

  const closeEdit = () => { setEditingId(null); setEditDraft(null); setEditError(''); };

  const handleEditSave = async (studentId) => {
    setEditSaving(true);
    setEditError('');
    try {
      await updateStudentProfile(studentId, editDraft);
      closeEdit();
      await load();
    } catch (err) {
      const status = err?.response?.status;
      setEditError(status === 409
        ? 'Этот телефон ученика уже есть у другого пользователя'
        : (err?.response?.data?.detail || 'Не удалось сохранить'));
    } finally {
      setEditSaving(false);
    }
  };

  const editField = (key, label, placeholder) => (
    <label style={s.editLabel}>
      {label}
      <input
        style={s.addInput}
        value={editDraft[key]}
        placeholder={placeholder}
        onChange={e => setEditDraft({ ...editDraft, [key]: e.target.value })}
      />
    </label>
  );

  const handleRestore = async (studentId) => {
    setBusyId(studentId);
    setError('');
    try {
      await restoreGroupMember(groupId, studentId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось восстановить');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.title}>
          {'Ученики'} — {groupName}
        </h3>

        <div style={s.tabs}>
          <button
            style={tab === 'active' ? s.tabActive : s.tab}
            onClick={() => setTab('active')}
          >
            {'Активные'}
          </button>
          <button
            style={tab === 'archived' ? s.tabActive : s.tab}
            onClick={() => setTab('archived')}
          >
            {'Архив'}
          </button>
          {tab === 'active' && (
            <button style={s.addToggle} onClick={() => setShowAdd(v => !v)}>
              {showAdd ? 'Скрыть поиск' : '+ Добавить ученика'}
            </button>
          )}
        </div>

        {tab === 'active' && showAdd && (
          <div style={s.addBox}>
            <input
              style={s.addInput}
              placeholder={'Имя или логин...'}
              value={addQuery}
              onChange={e => setAddQuery(e.target.value)}
              autoFocus
            />
            {addLoading && <p style={s.info}>{'Ищем...'}</p>}
            {!addLoading && addResults.length === 0 && (
              <p style={s.info}>{'Никого не нашли'}</p>
            )}
            {!addLoading && addResults.map(st => (
              <div key={st.id} style={s.addRow}>
                <span>{st.full_name || st.username} {st.full_name ? `(${st.username})` : ''}</span>
                <button
                  style={s.smallBtn}
                  disabled={addingId === st.id}
                  onClick={() => handleAdd(st.id)}
                >
                  {addingId === st.id ? '...' : 'Добавить'}
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && <p style={s.info}>{'Загрузка...'}</p>}
        {error && <p style={s.error}>{error}</p>}

        {!loading && (
          <div className="table-scroll">
          <table className="table table--on-white">
            <thead>
              <tr>
                <th>{'Имя'}</th>
                <th>{'Логин'}</th>
                <th>{'Телефон'}</th>
                {tab === 'active' && <th>{'Дата регистрации'}</th>}
                {tab === 'archived' && <th>{'Причина'}</th>}
                {tab === 'archived' && <th>{'Дата отчисления'}</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                    {tab === 'active' ? 'Учеников пока нет' : 'Архив пуст'}
                  </td>
                </tr>
              )}
              {students.map(st => (
                <React.Fragment key={st.id}>
                  <tr>
                    <td>{st.full_name || '—'}</td>
                    <td>{st.username}</td>
                    {/* нет телефона — красный прочерк, чтобы пропуск было видно сразу */}
                    <td className="nowrap" style={{ color: st.phone ? undefined : '#B91C1C' }}>{st.phone || '—'}</td>
                    {tab === 'active' && (
                      <td>{st.created_at ? new Date(st.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                    )}
                    {tab === 'archived' && <td>{st.expel_reason || '—'}</td>}
                    {tab === 'archived' && (
                      <td>{st.expelled_at ? new Date(st.expelled_at).toLocaleDateString('ru-RU') : '—'}</td>
                    )}
                    <td>
                      {tab === 'active' && expellingId !== st.id && editingId !== st.id && (
                        <span style={s.rowActions}>
                          <button style={s.linkBtn} onClick={() => openEdit(st.id)}>
                            {'Изменить'}
                          </button>
                          <button
                            style={s.dangerLinkBtn}
                            onClick={() => { closeEdit(); setExpellingId(st.id); setExpelReason(''); }}
                          >
                            {'Отчислить'}
                          </button>
                        </span>
                      )}
                      {tab === 'archived' && (
                        <button
                          style={s.smallBtn}
                          disabled={busyId === st.id}
                          onClick={() => handleRestore(st.id)}
                        >
                          {busyId === st.id ? '...' : 'Вернуть'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {tab === 'active' && editingId === st.id && (
                    <tr>
                      <td colSpan={6} style={s.expelCell}>
                        <div style={s.editBox}>
                          {!editDraft && !editError && <p style={s.info}>{'Загрузка...'}</p>}
                          {editDraft && (
                            <div style={s.editGrid}>
                              {editField('full_name', 'Имя и фамилия')}
                              {editField('phone', 'Телефон ученика', PHONE_PLACEHOLDER)}
                              {editField('parent_name', 'Родитель')}
                              {editField('parent_phone', 'Телефон родителя', PHONE_PLACEHOLDER)}
                            </div>
                          )}
                          {editError && <p style={s.error}>{editError}</p>}
                          <div style={s.expelActions}>
                            <button style={s.smallBtn} onClick={closeEdit}>{'Отмена'}</button>
                            <button
                              style={s.saveBtn}
                              disabled={!editDraft || editSaving}
                              onClick={() => handleEditSave(st.id)}
                            >
                              {editSaving ? '...' : 'Сохранить'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {tab === 'active' && expellingId === st.id && (
                    <tr>
                      <td colSpan={6} style={s.expelCell}>
                        <div style={s.expelBox}>
                          <textarea
                            style={s.expelTextarea}
                            placeholder={'Причина отчисления (обязательно) — например, не оплатил или закончил обучение'}
                            value={expelReason}
                            onChange={e => setExpelReason(e.target.value)}
                            autoFocus
                          />
                          <div style={s.expelActions}>
                            <button
                              style={s.smallBtn}
                              onClick={() => { setExpellingId(null); setExpelReason(''); }}
                            >
                              {'Отмена'}
                            </button>
                            <button
                              style={s.dangerBtn}
                              disabled={!expelReason.trim() || busyId === st.id}
                              onClick={() => handleExpelConfirm(st.id)}
                            >
                              {busyId === st.id ? '...' : 'Отчислить'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}

        <div style={s.actions}>
          <button style={s.closeBtn} onClick={onClose}>
            {'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '100%', maxWidth: '760px', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 12px 32px rgba(0,0,0,0.2)', maxHeight: '85vh', overflowY: 'auto' },
  title: { margin: '0 0 1rem 0' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center' },
  tab: { padding: '6px 14px', background: '#f3f4f6', color: '#4B5563', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' },
  tabActive: { padding: '6px 14px', background: '#EC3013', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' },
  addToggle: { marginLeft: 'auto', padding: '6px 14px', background: 'white', color: '#EC3013', border: '1px solid #EC3013', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' },
  addBox: { background: '#f9fafb', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' },
  addInput: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9rem', boxSizing: 'border-box' },
  addRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px', fontSize: '0.9rem' },
  info: { color: '#6B7280', textAlign: 'center', padding: '1rem' },
  error: { color: '#B91C1C', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' },
  smallBtn: { padding: '5px 12px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' },
  rowActions: { display: 'inline-flex', gap: '12px', whiteSpace: 'nowrap' },
  linkBtn: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline', padding: 0 },
  editBox: { background: '#f9fafb', borderRadius: '8px', padding: '10px' },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' },
  editLabel: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#4B5563' },
  saveBtn: { padding: '5px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' },
  dangerLinkBtn: { background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline', padding: 0 },
  dangerBtn: { padding: '5px 14px', background: '#B91C1C', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' },
  expelCell: { padding: '0 10px 10px 10px', borderBottom: '1px solid #e8f4f0' },
  expelBox: { background: '#FEF2F2', borderRadius: '8px', padding: '10px' },
  expelTextarea: { width: '100%', minHeight: '54px', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  expelActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' },
  actions: { marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' },
  closeBtn: { padding: '8px 24px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};

export default StudentsModal;
