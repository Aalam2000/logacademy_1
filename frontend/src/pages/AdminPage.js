import React, { useState, useEffect, useRef } from 'react';
import api from '../api/auth';

const emptyTeacher = { username: '', password: '', full_name: '', email: '', phone: '', telegram_username: '' };
const emptyAdmin   = { username: '', password: '', full_name: '', email: '', phone: '', telegram_username: '' };
const emptyCourse  = { title: '' };
const emptyGroup   = { name: '', course_id: '', teacher_id: '', telegram_chat_id: '' };

function AdminPage() {
  const [tab, setTab] = useState('teachers');

  const [teachers, setTeachers] = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [groups,   setGroups]   = useState([]);

  const [newTeacher, setNewTeacher] = useState(emptyTeacher);
  const [newAdmin,   setNewAdmin]   = useState(emptyAdmin);
  const [newCourse,  setNewCourse]  = useState(emptyCourse);
  const [newGroup,   setNewGroup]   = useState(emptyGroup);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupDraft, setEditingGroupDraft] = useState(emptyGroup);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const groupsTableRef = useRef(null);

  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handleDocumentMouseDown = (event) => {
      if (tab !== 'groups' || editingGroupId === null || isSavingGroup) return;
      if (!groupsTableRef.current?.contains(event.target)) {
        saveEditingGroup();
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [tab, editingGroupId, editingGroupDraft, isSavingGroup]);

  const loadAll = () => {
    loadTeachers();
    loadAdmins();
    loadCourses();
    loadGroups();
  };

  const loadTeachers = async () => { const r = await api.get('/admin/teachers'); setTeachers(r.data); };
  const loadAdmins   = async () => { const r = await api.get('/admin/admins');   setAdmins(r.data); };
  const loadCourses  = async () => { const r = await api.get('/admin/courses');  setCourses(r.data); };
  const loadGroups   = async () => { const r = await api.get('/admin/groups');   setGroups(r.data); };

  const handleError = (e) => {
    setError(e.response?.data?.detail || 'Ошибка');
    setTimeout(() => setError(''), 4000);
  };

  const areAllGroupFieldsFilled = (groupData) => {
    return (
      groupData.name.trim() !== ''
      && String(groupData.course_id).trim() !== ''
      && String(groupData.teacher_id).trim() !== ''
      && String(groupData.telegram_chat_id).trim() !== ''
    );
  };

  const isNewGroupValid = areAllGroupFieldsFilled(newGroup);

  const createTeacher = async () => {
    try {
      await api.post('/admin/teachers', { ...newTeacher, role: 'teacher' });
      setNewTeacher(emptyTeacher);
      loadTeachers();
    } catch(e) { handleError(e); }
  };
  const deleteTeacher = async (id) => {
    try { await api.delete(`/admin/teachers/${id}`); loadTeachers(); }
    catch(e) { handleError(e); }
  };

  const createAdmin = async () => {
    try {
      await api.post('/admin/admins', { ...newAdmin, role: 'admin' });
      setNewAdmin(emptyAdmin);
      loadAdmins();
    } catch(e) { handleError(e); }
  };
  const deleteAdmin = async (id) => {
    try { await api.delete(`/admin/admins/${id}`); loadAdmins(); }
    catch(e) { handleError(e); }
  };

  const createCourse = async () => {
    try {
      await api.post('/admin/courses', newCourse);
      setNewCourse(emptyCourse);
      loadCourses();
    } catch(e) { handleError(e); }
  };
  const deleteCourse = async (id) => {
    try { await api.delete(`/admin/courses/${id}`); loadCourses(); }
    catch(e) { handleError(e); }
  };

  const createGroup = async () => {
    if (!isNewGroupValid) {
      setError('Заполните все поля группы');
      setTimeout(() => setError(''), 4000);
      return;
    }

    try {
      await api.post('/admin/groups', {
        ...newGroup,
        course_id:  parseInt(newGroup.course_id),
        teacher_id: parseInt(newGroup.teacher_id),
      });
      setNewGroup(emptyGroup);
      loadGroups();
    } catch(e) { handleError(e); }
  };
  const deleteGroup = async (id) => {
    try { await api.delete(`/admin/groups/${id}`); loadGroups(); }
    catch(e) { handleError(e); }
  };

  const startEditGroup = (group) => {
    if (isSavingGroup) return;
    setEditingGroupId(group.id);
    setEditingGroupDraft({
      name: group.name || '',
      course_id: String(group.course_id || ''),
      teacher_id: String(group.teacher_id || ''),
      telegram_chat_id: group.telegram_chat_id || '',
    });
  };

  const saveEditingGroup = async () => {
    if (editingGroupId === null || isSavingGroup) return;

    if (!areAllGroupFieldsFilled(editingGroupDraft)) {
      setError('Заполните все поля группы');
      setTimeout(() => setError(''), 4000);
      return;
    }

    try {
      setIsSavingGroup(true);
      const payload = {
        name: editingGroupDraft.name.trim(),
        course_id: parseInt(editingGroupDraft.course_id),
        teacher_id: parseInt(editingGroupDraft.teacher_id),
        telegram_chat_id: editingGroupDraft.telegram_chat_id.trim(),
      };
      const res = await api.patch(`/admin/groups/${editingGroupId}`, payload);
      setGroups(prev => prev.map(g => g.id === editingGroupId ? res.data : g));
      setEditingGroupId(null);
    } catch (e) {
      handleError(e);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const tabs = [
    { key: 'teachers', label: 'Педагоги' },
    { key: 'admins',   label: 'Админы' },
    { key: 'courses',  label: 'Курсы' },
    { key: 'groups',   label: 'Группы' },
  ];

  const teachersForGroups = [...teachers, ...admins].filter(
    (user, index, arr) => arr.findIndex(u => u.id === user.id) === index
  );

  const courseLabelById = (courseId) => courses.find(c => c.id === courseId)?.title || `#${courseId}`;
  const teacherLabelById = (teacherId) => {
    const user = teachersForGroups.find(u => u.id === teacherId);
    return user?.full_name || user?.username || `#${teacherId}`;
  };

  const userFields = (data, setData) => [
    ['username',          'Логин',    'text'],
    ['password',          'Пароль',   'password'],
    ['full_name',         'Полное имя', 'text'],
    ['email',             'Email',    'text'],
    ['phone',             'Телефон',  'text'],
    ['telegram_username', 'Telegram', 'text'],
  ].map(([field, label, type]) => (
    <input key={field} placeholder={label} style={s.input}
      type={type} autoComplete={field === 'username' || field === 'password' ? 'new-password' : 'off'}
      value={data[field]}
      onChange={e => setData({ ...data, [field]: e.target.value })}
    />
  ));

  const userTable = (list, onDelete) => (
    <table style={s.table}>
      <thead><tr>
        <th>{'Имя'}</th>
        <th>{'Логин'}</th>
        <th>{'Email'}</th>
        <th>{'Телефон'}</th>
        <th>{'Telegram'}</th>
        <th></th>
      </tr></thead>
      <tbody>
        {list.map(u => (
          <tr key={u.id}>
            <td>{u.full_name}</td>
            <td>{u.username}</td>
            <td>{u.email}</td>
            <td>{u.phone}</td>
            <td>{u.telegram_username}</td>
            <td>
              <button style={s.btnDel} onClick={() => onDelete(u.id)}>
                {'Удалить'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={s.wrap}>
      <h2>{'Администрирование'}</h2>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.tabs}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            style={{ ...s.tab, ...(tab === tb.key ? s.tabActive : {}) }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ПЕДАГОГИ */}
      {tab === 'teachers' && (
        <div>
          <h3>{'Новый педагог'}</h3>
          <div style={s.form}>
            {userFields(newTeacher, setNewTeacher)}
            <button style={s.btn} onClick={createTeacher}>{'+ Добавить'}</button>
          </div>
          <h3>{'Список педагогов'}</h3>
          {userTable(teachers, deleteTeacher)}
        </div>
      )}

      {/* АДМИНЫ */}
      {tab === 'admins' && (
        <div>
          <h3>{'Новый администратор'}</h3>
          <div style={s.form}>
            {userFields(newAdmin, setNewAdmin)}
            <button style={s.btn} onClick={createAdmin}>{'+ Добавить'}</button>
          </div>
          <h3>{'Список администраторов'}</h3>
          {userTable(admins, deleteAdmin)}
        </div>
      )}

      {/* КУРСЫ */}
      {tab === 'courses' && (
        <div>
          <h3>{'Новый курс'}</h3>
          <div style={s.form}>
            <input placeholder={'Название курса'} style={s.input}
              autoComplete="off"
              value={newCourse.title}
              onChange={e => setNewCourse({ title: e.target.value })}
            />
            <button style={s.btn} onClick={createCourse}>{'+ Добавить'}</button>
          </div>
          <h3>{'Список курсов'}</h3>
          <table style={s.table}>
            <thead><tr>
              <th>#</th>
              <th>{'Название'}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.title}</td>
                  <td>
                    <button style={s.btnDel} onClick={() => deleteCourse(c.id)}>
                      {'Удалить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ГРУППЫ */}
      {tab === 'groups' && (
        <div>
          <h3>{'Новая группа'}</h3>
          <div style={s.form}>
            <input placeholder={'Название группы'} style={s.input}
              autoComplete="off"
              value={newGroup.name}
              onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
            />
            <select style={s.input} value={newGroup.course_id}
              onChange={e => setNewGroup({ ...newGroup, course_id: e.target.value })}>
              <option value="">{'— Курс —'}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select style={s.input} value={newGroup.teacher_id}
              onChange={e => setNewGroup({ ...newGroup, teacher_id: e.target.value })}>
              <option value="">{'— Педагог —'}</option>
              {teachersForGroups.map(tc => <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>)}
            </select>
            <input placeholder={'Telegram chat_id'} style={s.input}
              autoComplete="off"
              value={newGroup.telegram_chat_id}
              onChange={e => setNewGroup({ ...newGroup, telegram_chat_id: e.target.value })}
            />
            <button
              style={{ ...s.btn, ...(isNewGroupValid ? {} : s.btnDisabled) }}
              onClick={createGroup}
              disabled={!isNewGroupValid}
            >
              {'+ Добавить'}
            </button>
          </div>
          <h3>{'Список групп'}</h3>
          <div ref={groupsTableRef}>
          <table style={s.table}>
            <thead><tr>
              <th>{'Название'}</th>
              <th>{'Курс'}</th>
              <th>{'Педагог'}</th>
              <th>{'Telegram chat_id'}</th>
              <th>{'Invite-код'}</th>
              <th>{'Статус'}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} onClick={() => startEditGroup(g)} style={s.groupRow}>
                  <td>
                    {editingGroupId === g.id ? (
                      <input
                        style={s.input}
                        value={editingGroupDraft.name}
                        onChange={e => setEditingGroupDraft({ ...editingGroupDraft, name: e.target.value })}
                      />
                    ) : g.name}
                  </td>
                  <td>
                    {editingGroupId === g.id ? (
                      <select
                        style={s.input}
                        value={editingGroupDraft.course_id}
                        onChange={e => setEditingGroupDraft({ ...editingGroupDraft, course_id: e.target.value })}
                      >
                        <option value="">{'— Курс —'}</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    ) : courseLabelById(g.course_id)}
                  </td>
                  <td>
                    {editingGroupId === g.id ? (
                      <select
                        style={s.input}
                        value={editingGroupDraft.teacher_id}
                        onChange={e => setEditingGroupDraft({ ...editingGroupDraft, teacher_id: e.target.value })}
                      >
                        <option value="">{'— Педагог —'}</option>
                        {teachersForGroups.map(tc => <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>)}
                      </select>
                    ) : teacherLabelById(g.teacher_id)}
                  </td>
                  <td>
                    {editingGroupId === g.id ? (
                      <input
                        style={s.input}
                        value={editingGroupDraft.telegram_chat_id}
                        onChange={e => setEditingGroupDraft({ ...editingGroupDraft, telegram_chat_id: e.target.value })}
                      />
                    ) : g.telegram_chat_id}
                  </td>
                  <td><code>{g.invite_code}</code></td>
                  <td>{g.status}</td>
                  <td>
                    <button style={s.btnDel} onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}>
                      {'Удалить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:      { padding: '2rem' },
  error:     { background: '#fde8e8', color: '#c0392b', padding: '10px 16px', borderRadius: '8px', marginBottom: '1rem' },
  tabs:      { display: 'flex', gap: '8px', marginBottom: '1.5rem' },
  tab:       { padding: '8px 20px', border: '2px solid #c8f0ea', borderRadius: '20px', background: 'white', cursor: 'pointer', fontSize: '0.95rem' },
  tabActive: { background: '#3dbdaa', color: 'white', border: '2px solid #3dbdaa' },
  form:      { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem', alignItems: 'center' },
  input:     { padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.9rem', minWidth: '160px' },
  btn:       { padding: '8px 20px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  btnDel:    { padding: '4px 12px', background: '#e05050', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  groupRow: { cursor: 'pointer' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
};

export default AdminPage;