import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTENDANCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'in_person', label: 'Пришёл' },
  { value: 'online', label: 'Онлайн' },
  { value: 'excused', label: 'Ув. причина' },
  { value: 'absent', label: 'Не был' },
];

function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState('lesson'); // 'lesson' | 'students'

  const [lesson, setLesson] = useState(null);
  const [groups, setGroups] = useState([]);
  const [dateValue, setDateValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [marksLoading, setMarksLoading] = useState(false);
  const [marksLoaded, setMarksLoaded] = useState(false);
  const [marksError, setMarksError] = useState('');
  const [marksLocked, setMarksLocked] = useState(false);
  const [marksRows, setMarksRows] = useState([]);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const marksRowsRef = useRef([]);

  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsError, setMaterialsError] = useState('');
  const [lessonMaterials, setLessonMaterials] = useState([]);
  const [libraryMaterials, setLibraryMaterials] = useState([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  const [detachingId, setDetachingId] = useState(null);

  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizzesLoaded, setQuizzesLoaded] = useState(false);
  const [quizzesError, setQuizzesError] = useState('');
  const [lessonQuizzes, setLessonQuizzes] = useState([]);
  const [libraryQuizzes, setLibraryQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [isAttachingQuiz, setIsAttachingQuiz] = useState(false);
  const [detachingQuizId, setDetachingQuizId] = useState(null);

  useEffect(() => {
    marksRowsRef.current = marksRows;
  }, [marksRows]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [lessonRes, groupsRes] = await Promise.all([
          api.get(`/lessons/${lessonId}`),
          api.get('/groups/my'),
        ]);
        setLesson(lessonRes.data);
        setGroups(groupsRes.data);
        setDateValue(toInputDateTime(lessonRes.data?.date));
      } catch (err) {
        setError(err?.response?.data?.detail || 'Не удалось загрузить урок');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId]);

  useEffect(() => {
    if (view === 'students' && !marksLoaded) {
      loadMarks();
    }
    if (view === 'lesson' && !materialsLoaded) {
      loadMaterials();
    }
    if (view === 'lesson' && !quizzesLoaded) {
      loadQuizzes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const loadMarks = async () => {
    setMarksLoading(true);
    setMarksError('');
    try {
      const res = await api.get(`/lessons/${lessonId}/marks`);
      setMarksLocked(res.data.locked);
      setMarksRows(res.data.students.map(s => ({
        student_id: s.student_id,
        full_name: s.full_name,
        attendance_status: s.attendance_status || '',
        is_late: !!s.is_late,
        score: s.score === null || s.score === undefined ? '' : s.score,
        stars: s.stars || 0,
        comment: s.comment || '',
      })));
      setMarksLoaded(true);
    } catch (err) {
      setMarksError(err?.response?.data?.detail || 'Не удалось загрузить студентов');
    } finally {
      setMarksLoading(false);
    }
  };

  const loadMaterials = async () => {
    setMaterialsLoading(true);
    setMaterialsError('');
    try {
      const [attachedRes, libraryRes] = await Promise.all([
        api.get(`/lessons/${lessonId}/materials`),
        api.get('/materials/'),
      ]);
      setLessonMaterials(attachedRes.data);
      setLibraryMaterials(libraryRes.data);
      setMaterialsLoaded(true);
    } catch (err) {
      setMaterialsError(err?.response?.data?.detail || 'Не удалось загрузить материалы');
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleOpenMaterial = async (materialId, contentType) => {
    setMaterialsError('');
    try {
      const res = await api.get(`/materials/${materialId}/download`, { responseType: 'blob' });
      const type = res.headers?.['content-type'] || contentType || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setMaterialsError(err?.response?.data?.detail || 'Не удалось открыть файл');
    }
  };

  const handleAttachMaterial = async () => {
    if (!selectedLibraryId) return;
    setIsAttaching(true);
    setMaterialsError('');
    try {
      await api.post(`/lessons/${lessonId}/materials/${selectedLibraryId}`);
      setSelectedLibraryId('');
      await loadMaterials();
    } catch (err) {
      setMaterialsError(err?.response?.data?.detail || 'Не удалось привязать файл');
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetachMaterial = async (materialId) => {
    setDetachingId(materialId);
    setMaterialsError('');
    try {
      await api.delete(`/lessons/${lessonId}/materials/${materialId}`);
      setLessonMaterials(prev => prev.filter(m => m.material_id !== materialId));
    } catch (err) {
      setMaterialsError(err?.response?.data?.detail || 'Не удалось открепить файл');
    } finally {
      setDetachingId(null);
    }
  };

  const loadQuizzes = async () => {
    setQuizzesLoading(true);
    setQuizzesError('');
    try {
      const [attachedRes, libraryRes] = await Promise.all([
        api.get(`/lessons/${lessonId}/quizzes`),
        api.get('/quizzes/'),
      ]);
      setLessonQuizzes(attachedRes.data);
      // К уроку можно привязать только свободный квиз (ещё ни к какому
      // уроку не привязан) — иначе непонятно, откуда его «отвязывает».
      setLibraryQuizzes(libraryRes.data.filter(q => !q.lesson_id));
      setQuizzesLoaded(true);
    } catch (err) {
      setQuizzesError(err?.response?.data?.detail || 'Не удалось загрузить квизы');
    } finally {
      setQuizzesLoading(false);
    }
  };

  const handleOpenQuiz = async (quizId) => {
    setQuizzesError('');
    try {
      const res = await api.get(`/quizzes/${quizId}/html`);
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
    } catch (err) {
      setQuizzesError(err?.response?.data?.detail || 'Не удалось открыть квиз');
    }
  };

  const handleAttachQuiz = async () => {
    if (!selectedQuizId) return;
    setIsAttachingQuiz(true);
    setQuizzesError('');
    try {
      await api.post(`/lessons/${lessonId}/quizzes/${selectedQuizId}`);
      setSelectedQuizId('');
      await loadQuizzes();
    } catch (err) {
      setQuizzesError(err?.response?.data?.detail || 'Не удалось привязать квиз');
    } finally {
      setIsAttachingQuiz(false);
    }
  };

  const handleDetachQuiz = async (quizId) => {
    setDetachingQuizId(quizId);
    setQuizzesError('');
    try {
      await api.delete(`/lessons/${lessonId}/quizzes/${quizId}`);
      setLessonQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (err) {
      setQuizzesError(err?.response?.data?.detail || 'Не удалось открепить квиз');
    } finally {
      setDetachingQuizId(null);
    }
  };

  const updateRowField = (studentId, field, value) => {
    setMarksRows(prev => prev.map(r => (r.student_id === studentId ? { ...r, [field]: value } : r)));
  };

  const buildPayload = (row) => ({
    attendance_status: row.attendance_status || null,
    is_late: !!row.is_late,
    score: row.score === '' ? null : Number(row.score),
    stars: row.stars || 0,
    comment: row.comment || null,
  });

  const saveRow = async (studentId, rowOverride) => {
    const row = rowOverride || marksRowsRef.current.find(r => r.student_id === studentId);
    if (!row) return;

    setSavingIds(prev => new Set(prev).add(studentId));
    setRowErrors(prev => ({ ...prev, [studentId]: '' }));
    try {
      await api.put(`/lessons/${lessonId}/marks/${studentId}`, buildPayload(row));
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [studentId]: err?.response?.data?.detail || 'Не удалось сохранить' }));
      if (err?.response?.status === 403) {
        setMarksLocked(true);
      }
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const handleImmediateChange = (studentId, field, value) => {
    const current = marksRowsRef.current.find(r => r.student_id === studentId);
    if (!current) return;
    const updated = { ...current, [field]: value };
    setMarksRows(prev => prev.map(r => (r.student_id === studentId ? updated : r)));
    saveRow(studentId, updated);
  };

  const handleStarsClick = (studentId, value) => {
    const current = marksRowsRef.current.find(r => r.student_id === studentId);
    if (!current) return;
    const newValue = current.stars === value ? 0 : value;
    handleImmediateChange(studentId, 'stars', newValue);
  };

  const handleBlurSave = (studentId) => {
    saveRow(studentId);
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    setMarksError('');
    try {
      const items = marksRowsRef.current.map(r => ({ student_id: r.student_id, ...buildPayload(r) }));
      await api.put(`/lessons/${lessonId}/marks`, items);
      setRowErrors({});
    } catch (err) {
      setMarksError(err?.response?.data?.detail || 'Не удалось сохранить таблицу');
      if (err?.response?.status === 403) {
        setMarksLocked(true);
      }
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!lesson) return;

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        date: dateValue ? new Date(dateValue).toISOString() : null,
      };
      const res = await api.patch(`/lessons/${lesson.id}`, payload);
      setLesson(res.data);
      setDateValue(toInputDateTime(res.data?.date));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOpen = async () => {
    if (!lesson) return;

    setIsTogglingOpen(true);
    setError('');
    try {
      const res = await api.patch(`/lessons/${lesson.id}/open`);
      setLesson(prev => ({ ...prev, is_open: res.data.is_open }));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось изменить доступ к уроку');
    } finally {
      setIsTogglingOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!lesson || isDeleting) return;
    const confirmed = window.confirm('Удалить этот урок?');
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/lessons/${lesson.id}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось удалить урок');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="page page--md">{'Загрузка...'}</div>;
  }

  if (!lesson) {
    return (
      <div className="page page--md">
        {error || 'Урок не найден'}
      </div>
    );
  }

  const groupName = groups.find(g => g.id === lesson.group_id)?.name || `#${lesson.group_id}`;

  return (
    <div className="page page--md">
      <div className="toolbar">
        <button className="btn btn--outline" onClick={() => navigate(`/dashboard/groups/${lesson.group_id}`)}>
          {'Назад'}
        </button>
        <div className="toolbar__filters">
          <button
            type="button"
            className={`tab${view === 'lesson' ? ' tab--active' : ''}`}
            onClick={() => setView('lesson')}
          >
            {'Урок'}
          </button>
          <button
            type="button"
            className={`tab${view === 'students' ? ' tab--active' : ''}`}
            onClick={() => setView('students')}
          >
            {'Студенты'}
          </button>
        </div>
      </div>

      <h2 className="page__heading">{lesson.title}</h2>

      <div className="inline-row">
        <span>{'Группа'}: {groupName}</span>
        <span className={`badge ${lesson.is_open ? 'badge--open' : 'badge--closed'}`}>
          {lesson.is_open ? 'Открыт' : 'Закрыт'}
        </span>
      </div>

      {view === 'lesson' && (
        <>
          <form onSubmit={handleSave} className="form-card">
            <label className="field-label">
              {'Дата и время начала'}
              <input
                type="datetime-local"
                className="input input--narrow"
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
              />
            </label>

            <div className="button-row">
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" className="btn btn--info" onClick={handleToggleOpen} disabled={isTogglingOpen}>
                {isTogglingOpen
                  ? 'Сохранение...'
                  : lesson.is_open
                    ? 'Закрыть урок'
                    : 'Открыть урок'}
              </button>
              <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Сохранение...' : 'Удалить'}
              </button>
            </div>
          </form>

          {error && <div className="error-text error-text--muted">{error}</div>}

          <div className="toolbar">
            <h3 className="toolbar__title">{'Материалы урока'}</h3>
          </div>

          {materialsLoading && <p className="text-muted">{'Загрузка...'}</p>}
          {materialsError && <div className="error-text error-text--muted">{materialsError}</div>}

          {!materialsLoading && materialsLoaded && (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{'Имя файла'}</th>
                      <th>{'Размер'}</th>
                      <th>{'Добавил'}</th>
                      <th>{'Дата'}</th>
                      <th>{'Открепить'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessonMaterials.length === 0 ? (
                      <tr><td colSpan="5" className="table__empty">{'К уроку не привязано файлов'}</td></tr>
                    ) : (
                      lessonMaterials.map(m => (
                        <tr key={m.material_id}>
                          <td>
                            <button
                              type="button"
                              className="link"
                              onClick={() => handleOpenMaterial(m.material_id, m.content_type)}
                            >
                              {m.original_filename}
                            </button>
                          </td>
                          <td className="nowrap">{formatSize(m.size_bytes)}</td>
                          <td>{m.added_by_name || '—'}</td>
                          <td className="nowrap">{m.added_at ? new Date(m.added_at).toLocaleDateString('ru-RU') : '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => handleDetachMaterial(m.material_id)}
                              disabled={detachingId === m.material_id}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-toolbar">
                <select
                  className="input"
                  value={selectedLibraryId}
                  onChange={e => setSelectedLibraryId(e.target.value)}
                >
                  <option value="">{'Выбрать файл из базы знаний...'}</option>
                  {libraryMaterials
                    .filter(lm => !lessonMaterials.some(am => am.material_id === lm.id))
                    .map(lm => (
                      <option key={lm.id} value={lm.id}>{lm.original_filename}</option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={handleAttachMaterial}
                  disabled={!selectedLibraryId || isAttaching}
                >
                  {isAttaching ? 'Добавление...' : 'Добавить'}
                </button>
              </div>

              {libraryMaterials.length === 0 && (
                <p className="hint-text">{'В базе знаний пока нет файлов'}</p>
              )}
            </>
          )}

          <div className="toolbar">
            <h3 className="toolbar__title">{'Квизы урока'}</h3>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => navigate(`/dashboard/add-quiz?lessonId=${lessonId}`)}
            >
              + {'Создать квиз для урока'}
            </button>
          </div>

          {quizzesLoading && <p className="text-muted">{'Загрузка...'}</p>}
          {quizzesError && <div className="error-text error-text--muted">{quizzesError}</div>}

          {!quizzesLoading && quizzesLoaded && (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{'Название'}</th>
                      <th>{'Тема'}</th>
                      <th>{'Тип'}</th>
                      <th>{'Открыть'}</th>
                      <th>{'Открепить'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessonQuizzes.length === 0 ? (
                      <tr><td colSpan="5" className="table__empty">{'К уроку не привязано квизов'}</td></tr>
                    ) : (
                      lessonQuizzes.map(q => (
                        <tr key={q.id}>
                          <td>{q.title}</td>
                          <td>{q.topic || '—'}</td>
                          <td>{q.template_type}</td>
                          <td>
                            <button type="button" className="btn btn--sm" onClick={() => handleOpenQuiz(q.id)}>
                              📂
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => handleDetachQuiz(q.id)}
                              disabled={detachingQuizId === q.id}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-toolbar">
                <select
                  className="input"
                  value={selectedQuizId}
                  onChange={e => setSelectedQuizId(e.target.value)}
                >
                  <option value="">{'Выбрать квиз из своей библиотеки...'}</option>
                  {libraryQuizzes.map(lq => (
                    <option key={lq.id} value={lq.id}>{lq.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={handleAttachQuiz}
                  disabled={!selectedQuizId || isAttachingQuiz}
                >
                  {isAttachingQuiz ? 'Добавление...' : 'Добавить'}
                </button>
              </div>

              {libraryQuizzes.length === 0 && (
                <p className="hint-text">{'Нет свободных квизов для привязки — все уже привязаны к урокам, либо ещё не созданы'}</p>
              )}
            </>
          )}
        </>
      )}

      {view === 'students' && (
        <div>
          {marksLoading && <p className="text-muted">{'Загрузка...'}</p>}
          {marksError && <div className="error-text error-text--muted">{marksError}</div>}

          {!marksLoading && marksLoaded && (
            <>
              {marksLocked && (
                <p className="text-muted">
                  {'Урок заблокирован для редактирования (прошла полночь по Баку).'}
                </p>
              )}

              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{'Имя'}</th>
                      <th>{'Посещаемость'}</th>
                      <th>{'Опоздал'}</th>
                      <th>{'Оценка'}</th>
                      <th>{'Звёзды'}</th>
                      <th>{'Комментарий'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksRows.length === 0 ? (
                      <tr><td colSpan="6" className="table__empty">{'В группе нет студентов'}</td></tr>
                    ) : (
                      marksRows.map(row => {
                        const lateDisabled = marksLocked
                          || !row.attendance_status
                          || row.attendance_status === 'excused'
                          || row.attendance_status === 'absent';
                        return (
                          <tr key={row.student_id}>
                            <td>{row.full_name}</td>
                            <td>
                              <select
                                className="input"
                                value={row.attendance_status}
                                disabled={marksLocked}
                                onChange={e => handleImmediateChange(row.student_id, 'attendance_status', e.target.value)}
                              >
                                {ATTENDANCE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.is_late}
                                disabled={lateDisabled}
                                onChange={e => handleImmediateChange(row.student_id, 'is_late', e.target.checked)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="input input--sm-num"
                                value={row.score}
                                disabled={marksLocked}
                                onChange={e => updateRowField(row.student_id, 'score', e.target.value)}
                                onBlur={() => handleBlurSave(row.student_id)}
                              />
                            </td>
                            <td>
                              <div className="star-picker">
                                {[1, 2, 3].map(n => (
                                  <button
                                    key={n}
                                    type="button"
                                    className={`star-picker__btn${row.stars >= n ? ' star-picker__btn--active' : ''}`}
                                    disabled={marksLocked}
                                    onClick={() => handleStarsClick(row.student_id, n)}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="input"
                                value={row.comment}
                                disabled={marksLocked}
                                onChange={e => updateRowField(row.student_id, 'comment', e.target.value)}
                                onBlur={() => handleBlurSave(row.student_id)}
                              />
                              {savingIds.has(row.student_id) && (
                                <div className="hint-text">{'Сохранение…'}</div>
                              )}
                              {rowErrors[row.student_id] && (
                                <div className="error-text--sm">{rowErrors[row.student_id]}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {marksRows.length > 0 && (
                <div className="button-row">
                  <button type="button" className="btn" onClick={handleSaveAll} disabled={isSavingAll || marksLocked}>
                    {isSavingAll ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default LessonPage;
