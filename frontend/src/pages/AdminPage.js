import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

const emptyTeacher = { username: '', password: '', full_name: '', email: '', phone: '', telegram_username: '' };
const emptyAdmin   = { username: '', password: '', full_name: '', email: '', phone: '', telegram_username: '' };
const emptyCourse  = { title: '' };
const emptyGroup   = { name: '', course_id: '', teacher_id: '', telegram_chat_id: '' };

function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState('teachers');

  const [teachers, setTeachers] = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [groups,   setGroups]   = useState([]);

  const [newTeacher, setNewTeacher] = useState(emptyTeacher);
  const [newAdmin,   setNewAdmin]   = useState(emptyAdmin);
  const [newCourse,  setNewCourse]  = useState(emptyCourse);
  const [newGroup,   setNewGroup]   = useState(emptyGroup);

  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

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
    setError(e.response?.data?.detail || t('error_unknown', 'Ошибка'));
    setTimeout(() => setError(''), 4000);
  };

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

  const tabs = [
    { key: 'teachers', label: t('admin_tab_teachers', 'Педагоги') },
    { key: 'admins',   label: t('admin_tab_admins',   'Админы') },
    { key: 'courses',  label: t('admin_tab_courses',  'Курсы') },
    { key: 'groups',   label: t('admin_tab_groups',   'Группы') },
  ];

  const userFields = (data, setData) => [
    ['username',          t('field_username', 'Логин'),    'text'],
    ['password',          t('field_password', 'Пароль'),   'password'],
    ['full_name',         t('field_fullname', 'Полное имя'), 'text'],
    ['email',             t('field_email',    'Email'),    'text'],
    ['phone',             t('field_phone',    'Телефон'),  'text'],
    ['telegram_username', t('field_telegram', 'Telegram'), 'text'],
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
        <th>{t('field_fullname', 'Имя')}</th>
        <th>{t('field_username', 'Логин')}</th>
        <th>{t('field_email',    'Email')}</th>
        <th>{t('field_phone',    'Телефон')}</th>
        <th>{t('field_telegram', 'Telegram')}</th>
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
                {t('admin_delete', 'Удалить')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={s.wrap}>
      <h2>{t('admin_title', 'Администрирование')}</h2>

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
          <h3>{t('admin_teachers_new', 'Новый педагог')}</h3>
          <div style={s.form}>
            {userFields(newTeacher, setNewTeacher)}
            <button style={s.btn} onClick={createTeacher}>{t('admin_add', '+ Добавить')}</button>
          </div>
          <h3>{t('admin_teachers_list', 'Список педагогов')}</h3>
          {userTable(teachers, deleteTeacher)}
        </div>
      )}

      {/* АДМИНЫ */}
      {tab === 'admins' && (
        <div>
          <h3>{t('admin_admins_new', 'Новый администратор')}</h3>
          <div style={s.form}>
            {userFields(newAdmin, setNewAdmin)}
            <button style={s.btn} onClick={createAdmin}>{t('admin_add', '+ Добавить')}</button>
          </div>
          <h3>{t('admin_admins_list', 'Список администраторов')}</h3>
          {userTable(admins, deleteAdmin)}
        </div>
      )}

      {/* КУРСЫ */}
      {tab === 'courses' && (
        <div>
          <h3>{t('admin_courses_new', 'Новый курс')}</h3>
          <div style={s.form}>
            <input placeholder={t('field_course_title', 'Название курса')} style={s.input}
              autoComplete="off"
              value={newCourse.title}
              onChange={e => setNewCourse({ title: e.target.value })}
            />
            <button style={s.btn} onClick={createCourse}>{t('admin_add', '+ Добавить')}</button>
          </div>
          <h3>{t('admin_courses_list', 'Список курсов')}</h3>
          <table style={s.table}>
            <thead><tr>
              <th>#</th>
              <th>{t('field_course_title', 'Название')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.title}</td>
                  <td>
                    <button style={s.btnDel} onClick={() => deleteCourse(c.id)}>
                      {t('admin_delete', 'Удалить')}
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
          <h3>{t('admin_groups_new', 'Новая группа')}</h3>
          <div style={s.form}>
            <input placeholder={t('field_group_name', 'Название группы')} style={s.input}
              autoComplete="off"
              value={newGroup.name}
              onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
            />
            <select style={s.input} value={newGroup.course_id}
              onChange={e => setNewGroup({ ...newGroup, course_id: e.target.value })}>
              <option value="">{t('field_select_course', '— Курс —')}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select style={s.input} value={newGroup.teacher_id}
              onChange={e => setNewGroup({ ...newGroup, teacher_id: e.target.value })}>
              <option value="">{t('field_select_teacher', '— Педагог —')}</option>
              {teachers.map(tc => <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>)}
            </select>
            <input placeholder={t('field_tg_chat', 'Telegram chat_id')} style={s.input}
              autoComplete="off"
              value={newGroup.telegram_chat_id}
              onChange={e => setNewGroup({ ...newGroup, telegram_chat_id: e.target.value })}
            />
            <button style={s.btn} onClick={createGroup}>{t('admin_add', '+ Добавить')}</button>
          </div>
          <h3>{t('admin_groups_list', 'Список групп')}</h3>
          <table style={s.table}>
            <thead><tr>
              <th>{t('field_group_name',   'Название')}</th>
              <th>{t('field_course_title', 'Курс')}</th>
              <th>{t('field_teacher',      'Педагог')}</th>
              <th>{t('field_invite',       'Invite-код')}</th>
              <th>{t('field_status',       'Статус')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{courses.find(c => c.id === g.course_id)?.title}</td>
                  <td>{teachers.find(tc => tc.id === g.teacher_id)?.full_name || teachers.find(tc => tc.id === g.teacher_id)?.username}</td>
                  <td><code>{g.invite_code}</code></td>
                  <td>{g.status}</td>
                  <td>
                    <button style={s.btnDel} onClick={() => deleteGroup(g.id)}>
                      {t('admin_delete', 'Удалить')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  btnDel:    { padding: '4px 12px', background: '#e05050', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
};

export default AdminPage;