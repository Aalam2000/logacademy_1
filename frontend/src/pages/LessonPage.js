import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/auth';
import DateTimePicker, { formatDateTime } from '../components/DateTimePicker';
import LibraryPickerModal from '../components/LibraryPickerModal';
import TrashIcon from '../components/TrashIcon';
import { TYPE_META, formatSize, subtypeLabel, resourceKey, needsPdfPreview } from '../utils/libraryItems';
import { extractErrorMessage } from '../utils/errors';
import { StudentContactIcons } from '../components/ContactIcons';
import { subscribeLessonMarksUpdated } from '../utils/lessonMarksChannel';
import { HomeworkAddModal, HomeworkFlags, HomeworkCheckView, personalOrCommonDeadline } from '../components/HomeworkTeacher';
import { DialogCell } from '../components/LessonDialog';
import { getHomeworkBoard } from '../api/homework';
import { uploadMaterial } from '../api/materials';

// 409 от бэкенда при контроле дублей: code=same_name — спросить и
// повторить с подтверждением; code=duplicate — вернуть existing_id.
const conflictOf = (err) => (err?.response?.status === 409 ? err.response.data : null);

// Кружки посещаемости вместо select'а. Пришёл/Онлайн/Уважительная —
// взаимоисключающие («ИЛИ», attendance_status), «Опоздал» — независимый
// модификатор («И» поверх Пришёл или Онлайн: is_late), недоступен при
// Уважительной причине и при отсутствии отметки (см. решение Андрея,
// 2026-09-15). Если не выбрано ничего из первых трёх — считаем пропуском.
const ATTENDANCE_STATUS_BUTTONS = [
  { kind: 'in_person', status: 'in_person', label: 'Пришёл' },
  { kind: 'online', status: 'online', label: 'Онлайн' },
  { kind: 'excused', status: 'excused', label: 'Уважительная причина' },
];
const LATE_STATUSES = new Set(['in_person', 'online']);

function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState('lesson'); // 'lesson' | 'students'

  const [lesson, setLesson] = useState(null);
  const [groups, setGroups] = useState([]);
  const [dateValue, setDateValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lessonComment, setLessonComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  const [marksLoading, setMarksLoading] = useState(false);
  const [marksLoaded, setMarksLoaded] = useState(false);
  const [marksError, setMarksError] = useState('');
  const [marksLocked, setMarksLocked] = useState(false);
  const [marksRows, setMarksRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const marksRowsRef = useRef([]);

  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [lessonItems, setLessonItems] = useState([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [detachingKey, setDetachingKey] = useState(null);
  const [openingKey, setOpeningKey] = useState(null);

  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const materialInputRef = useRef(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // ДЗ: загрузка файла сразу как ДЗ (+ «Кому») и список студентов для «Кому»
  // ДЗ (схема v2): задания урока + по каждому студенту статусы/оценки и диалог
  const [hwBoard, setHwBoard] = useState({ tasks: [], students: [], to_review: 0 });
  const [hwAddOpen, setHwAddOpen] = useState(false);
  const [hwAddFor, setHwAddFor] = useState(null); // строка студента — персональный файл в ДЗ
  // «Проверить ДЗ»: таблица перестраивается под приём и оценку ДЗ
  const [hwCheckMode, setHwCheckMode] = useState(false);
  const [itemsNotice, setItemsNotice] = useState('');

  useEffect(() => {
    marksRowsRef.current = marksRows;
  }, [marksRows]);

  useEffect(() => {
    // Смена урока (переход по ссылке без ремаунта компонента) — сбрасываем
    // кэш вкладок «Студенты»/«Урок», иначе показывались бы данные
    // предыдущего урока, пока не потрогать их руками.
    setMarksLoaded(false);
    setItemsLoaded(false);

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
        setDateValue(lessonRes.data?.date ? new Date(lessonRes.data.date) : null);
        setLessonComment(lessonRes.data?.comment || '');
      } catch (err) {
        setError(extractErrorMessage(err, 'Не удалось загрузить урок'));
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
    if (view === 'lesson' && !itemsLoaded) {
      loadItems();
    }
    // eslint-disable-next-line
  }, [view, lessonId]);

  // Сигнал от вкладки живого квиза-«Экзамен» (та же группа браузера) — как
  // только там записалась оценка, подтягиваем табличку здесь заново, не
  // дожидаясь ручной перезагрузки страницы.
  useEffect(() => {
    return subscribeLessonMarksUpdated((updatedLessonId) => {
      if (String(updatedLessonId) === String(lessonId)) {
        loadMarks();
      }
    });
    // eslint-disable-next-line
  }, [lessonId]);

  const loadMarks = async () => {
    setMarksLoading(true);
    setMarksError('');
    try {
      const [res] = await Promise.all([
        api.get(`/lessons/${lessonId}/marks`),
        loadHomework(),
      ]);
      setMarksLocked(res.data.locked);
      setMarksRows(res.data.students.map(s => ({
        student_id: s.student_id,
        full_name: s.full_name,
        telegram_username: s.telegram_username,
        whatsapp: s.whatsapp,
        attendance_status: s.attendance_status || '',
        is_late: !!s.is_late,
        score: s.score === null || s.score === undefined ? '' : s.score,
        exam_score: s.exam_score === null || s.exam_score === undefined ? '' : s.exam_score,
        stars: s.stars || 0,
        comment: s.comment || '',
      })));
      setMarksLoaded(true);
    } catch (err) {
      setMarksError(extractErrorMessage(err, 'Не удалось загрузить студентов'));
    } finally {
      setMarksLoading(false);
    }
  };

  // Тихо (без «Загрузка...»): вызывается и после каждой правки ДЗ/диалога
  const loadHomework = async () => {
    try {
      setHwBoard(await getHomeworkBoard(lessonId));
    } catch (err) {
      setMarksError(extractErrorMessage(err, 'Не удалось загрузить домашние задания'));
    }
  };

  const loadItems = async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const res = await api.get(`/lessons/${lessonId}/items`);
      setLessonItems(res.data);
      setItemsLoaded(true);
    } catch (err) {
      setItemsError(extractErrorMessage(err, 'Не удалось загрузить материалы'));
    } finally {
      setItemsLoading(false);
    }
  };

  // Окно под файл/квиз открываем сразу, синхронно по клику — если открыть
  // его уже после await, браузер считает это всплывающим окном не по
  // действию пользователя и блокирует.
  const handleOpenItem = async (item) => {
    setItemsError('');

    if (item.resource_type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const key = resourceKey(item.resource_type, item.resource_id);
    setOpeningKey(key);
    const win = window.open('', '_blank');
    const isConverting = item.resource_type === 'material' && needsPdfPreview(item.content_type);
    if (win && isConverting) {
      win.document.write('<p style="font-family:sans-serif;color:#4B5563;padding:24px">Конвертируем файл в PDF...</p>');
      win.document.close();
    }
    try {
      if (item.resource_type === 'material') {
        const endpoint = needsPdfPreview(item.content_type) ? 'preview' : 'download';
        const res = await api.get(`/materials/${item.resource_id}/${endpoint}`, { responseType: 'blob' });
        const fallbackType = endpoint === 'preview' ? 'application/pdf' : (item.content_type || 'application/octet-stream');
        const type = res.headers?.['content-type'] || fallbackType;
        const url = window.URL.createObjectURL(new Blob([res.data], { type }));
        const openUrl = type === 'application/pdf' ? `${url}#navpanes=0` : url;
        if (win) win.location.href = openUrl;
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else if (item.resource_type === 'quiz' && item.template_type === 'live') {
        // Живой квиз — не статичный HTML, а страница хоста: открываем игру
        // на бэкенде и переводим уже открытую вкладку на неё.
        const res = await api.post(`/quiz-live/${item.resource_id}/open`, { lesson_id: Number(lessonId) });
        if (win) win.location.href = `/quiz-live/${res.data.code}/host`;
      } else {
        const res = await api.get(`/quizzes/${item.resource_id}/html`);
        if (win) {
          win.document.write(res.data.html);
          win.document.close();
        }
      }
    } catch (err) {
      if (win) win.close();
      setItemsError(extractErrorMessage(err, 'Не удалось открыть'));
    } finally {
      setOpeningKey(null);
    }
  };

  const handleDetachItem = async (item) => {
    const key = resourceKey(item.resource_type, item.resource_id);
    setDetachingKey(key);
    setItemsError('');
    try {
      await api.delete(`/lessons/${lessonId}/items/${item.resource_type}/${item.resource_id}`);
      setLessonItems(prev => prev.filter(i => resourceKey(i.resource_type, i.resource_id) !== key));
    } catch (err) {
      setItemsError(extractErrorMessage(err, 'Не удалось открепить'));
    } finally {
      setDetachingKey(null);
    }
  };

  // Загрузить новый файл и сразу привязать к уроку (в библиотеке он тоже
  // остаётся — как и всё в «Базе знаний»)
  const handlePickMaterial = () => materialInputRef.current?.click();

  const handleUploadMaterial = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMaterial(true);
    setItemsError('');
    setItemsNotice('');
    try {
      let materialId;
      try {
        materialId = (await uploadMaterial(file)).id;
      } catch (err) {
        const c = conflictOf(err);
        if (c?.code === 'duplicate') {
          // Такой файл уже есть в БЗ — привязываем существующий, копию не создаём
          materialId = c.existing_id;
          setItemsNotice(`${c.detail} — привязан существующий`);
        } else if (c?.code === 'same_name' && window.confirm(c.detail)) {
          materialId = (await uploadMaterial(file, undefined, true)).id;
        } else {
          throw err;
        }
      }
      await api.post(`/lessons/${lessonId}/items`, {
        resource_type: 'material',
        resource_id: materialId,
      });
      await loadItems();
    } catch (err) {
      setItemsError(extractErrorMessage(err, 'Не удалось загрузить файл'));
    } finally {
      if (materialInputRef.current) materialInputRef.current.value = '';
      setIsUploadingMaterial(false);
    }
  };

  // Создать новую ссылку и сразу привязать к уроку
  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    setIsAddingLink(true);
    setItemsError('');
    setItemsNotice('');
    try {
      let linkId;
      try {
        linkId = (await api.post('/links/', { title: linkTitle.trim(), url: linkUrl.trim() })).data.id;
      } catch (err) {
        const c = conflictOf(err);
        if (c?.code !== 'duplicate') throw err;
        // Такая ссылка уже есть в БЗ — привязываем существующую
        linkId = c.existing_id;
        setItemsNotice(`${c.detail} — привязана существующая`);
      }
      await api.post(`/lessons/${lessonId}/items`, {
        resource_type: 'link',
        resource_id: linkId,
      });
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      await loadItems();
    } catch (err) {
      setItemsError(extractErrorMessage(err, 'Не удалось добавить ссылку'));
    } finally {
      setIsAddingLink(false);
    }
  };

  const updateRowField = (studentId, field, value) => {
    setMarksRows(prev => prev.map(r => (r.student_id === studentId ? { ...r, [field]: value } : r)));
  };

  const buildPayload = (row) => ({
    attendance_status: row.attendance_status || null,
    is_late: !!row.is_late,
    score: row.score === '' ? null : Number(row.score),
    exam_score: row.exam_score === '' ? null : Number(row.exam_score),
    stars: row.stars || 0,
    comment: row.comment || null,
  });

  const saveRow = async (studentId, rowOverride) => {
    const row = rowOverride || marksRowsRef.current.find(r => r.student_id === studentId);
    if (!row) return;

    setRowErrors(prev => ({ ...prev, [studentId]: '' }));
    try {
      await api.put(`/lessons/${lessonId}/marks/${studentId}`, buildPayload(row));
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [studentId]: extractErrorMessage(err, 'Не удалось сохранить') }));
      if (err?.response?.status === 403) {
        setMarksLocked(true);
      }
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

  // Клик по кружку Пришёл/Онлайн/Уважительная — как и звёзды, сохраняется
  // сразу, без blur. Повторный клик по уже активной кнопке снимает отметку
  // (пропуск). «Опоздал» комбинируется только с Пришёл/Онлайн — при уходе
  // на Уважительную или снятии отметки сбрасываем и его.
  const handleAttendanceClick = (studentId, btn) => {
    const current = marksRowsRef.current.find(r => r.student_id === studentId);
    if (!current) return;
    const isActive = current.attendance_status === btn.status;
    const nextStatus = isActive ? '' : btn.status;
    const updated = {
      ...current,
      attendance_status: nextStatus,
      is_late: LATE_STATUSES.has(nextStatus) ? current.is_late : false,
    };
    setMarksRows(prev => prev.map(r => (r.student_id === studentId ? updated : r)));
    saveRow(studentId, updated);
  };

  // «Опоздал» — независимый модификатор, доступен только поверх
  // Пришёл/Онлайн (см. LATE_STATUSES).
  const handleLateToggle = (studentId) => {
    const current = marksRowsRef.current.find(r => r.student_id === studentId);
    if (!current || !LATE_STATUSES.has(current.attendance_status)) return;
    const updated = { ...current, is_late: !current.is_late };
    setMarksRows(prev => prev.map(r => (r.student_id === studentId ? updated : r)));
    saveRow(studentId, updated);
  };

  // Оценка 0..100 — то же ограничение стоит на бэке (Field(ge=0, le=100)).
  // HTML min/max на <input type="number"> не мешает ввести 200 руками, а
  // бэк на такое ответит 422 — подрезаем на blur, до отправки.
  const handleScoreLikeBlur = (studentId, field) => {
    const current = marksRowsRef.current.find(r => r.student_id === studentId);
    if (current && current[field] !== '') {
      const clamped = Math.max(0, Math.min(100, Number(current[field])));
      if (clamped !== Number(current[field])) {
        const updated = { ...current, [field]: clamped };
        setMarksRows(prev => prev.map(r => (r.student_id === studentId ? updated : r)));
        saveRow(studentId, updated);
        return;
      }
    }
    saveRow(studentId);
  };

  const handleScoreBlur = (studentId) => handleScoreLikeBlur(studentId, 'score');
  const handleExamScoreBlur = (studentId) => handleScoreLikeBlur(studentId, 'exam_score');

  const saveAllRows = async (rowsOverride) => {
    const rows = rowsOverride || marksRowsRef.current;
    setIsSavingAll(true);
    setMarksError('');
    try {
      const items = rows.map(r => ({ student_id: r.student_id, ...buildPayload(r) }));
      await api.put(`/lessons/${lessonId}/marks`, items);
      setRowErrors({});
    } catch (err) {
      setMarksError(extractErrorMessage(err, 'Не удалось сохранить таблицу'));
      if (err?.response?.status === 403) {
        setMarksLocked(true);
      }
    } finally {
      setIsSavingAll(false);
    }
  };

  // «Все пришли» — отмечает всех присутствующими очно (без опозданий) и
  // сразу сохраняет всю таблицу разом.
  const handleMarkAllPresent = () => {
    if (marksLocked) return;
    const updated = marksRowsRef.current.map(r => ({ ...r, attendance_status: 'in_person', is_late: false }));
    setMarksRows(updated);
    saveAllRows(updated);
  };

  const handleCommitDate = async () => {
    if (!lesson) return;

    const originalTime = lesson.date ? new Date(lesson.date).getTime() : null;
    const newTime = dateValue ? dateValue.getTime() : null;
    if (originalTime === newTime) return;

    setIsSavingDate(true);
    setError('');
    try {
      const payload = { date: dateValue ? dateValue.toISOString() : null };
      const res = await api.patch(`/lessons/${lesson.id}`, payload);
      setLesson(res.data);
      setDateValue(res.data?.date ? new Date(res.data.date) : null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить изменения'));
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleCommitComment = async () => {
    if (!lesson) return;
    if ((lesson.comment || '') === lessonComment) return;

    setIsSavingComment(true);
    setError('');
    try {
      const res = await api.patch(`/lessons/${lesson.id}`, { comment: lessonComment });
      setLesson(res.data);
      setLessonComment(res.data?.comment || '');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить комментарий'));
    } finally {
      setIsSavingComment(false);
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
      setError(extractErrorMessage(err, 'Не удалось изменить доступ к уроку'));
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
      setError(extractErrorMessage(err, 'Не удалось удалить урок'));
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="page">{'Загрузка...'}</div>;
  }

  if (!lesson) {
    return (
      <div className="page">
        {error || 'Урок не найден'}
      </div>
    );
  }

  const groupName = groups.find(g => g.id === lesson.group_id)?.name || `#${lesson.group_id}`;

  return (
    <div className="page">
      <div className="toolbar">
        <div className="lesson-toolbar__info">
          <button className="btn btn--outline" onClick={() => navigate(`/dashboard/groups/${lesson.group_id}`)}>
            {'Назад'}
          </button>
          <span className="lesson-toolbar__group">{'Группа'}: {groupName}</span>
          <span className="lesson-toolbar__date">
            {formatDateTime(dateValue) || '—'}
            <DateTimePicker
              value={dateValue}
              onChange={setDateValue}
              onCommit={handleCommitDate}
              disabled={isSavingDate || lesson.is_locked}
              iconOnly
              floating
              tip={lesson.is_locked ? 'Прошла полночь — перенести урок нельзя' : 'Смена даты и времени урока'}
            />
          </span>
          <button
            type="button"
            className={`btn btn--sm${lesson.is_open ? '' : ' btn--muted'}`}
            onClick={handleToggleOpen}
            disabled={isTogglingOpen}
          >
            {isTogglingOpen ? '...' : (lesson.is_open ? 'Закрыть' : 'Открыть')}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--outline"
            onClick={handleDelete}
            disabled={isDeleting || lesson.is_locked}
            data-tip={lesson.is_locked ? 'Прошла полночь — удалить урок нельзя' : 'Удалить урок'}
          >
            <TrashIcon size={16} />
          </button>
        </div>
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

      {error && <div className="error-text error-text--muted">{error}</div>}

      {view === 'lesson' && (
        <>
          <div className="form-toolbar">
            <button type="button" className="btn btn--outline" onClick={() => setShowLibraryModal(true)}>
              {'Добавить из базы'}
            </button>
            <input
              type="file"
              ref={materialInputRef}
              onChange={handleUploadMaterial}
              hidden
            />
            <button type="button" className="btn btn--outline" onClick={handlePickMaterial} disabled={isUploadingMaterial}>
              {isUploadingMaterial ? 'Загрузка...' : '+ Файл'}
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => navigate(`/dashboard/add-quiz?lessonId=${lessonId}`)}
            >
              {'+ Квиз'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setShowLinkForm(v => !v)}>
              {'+ Ссылка'}
            </button>
          </div>

          {showLinkForm && (
            <div className="form-toolbar">
              <input
                type="text"
                className="input"
                placeholder={'Название ссылки'}
                value={linkTitle}
                onChange={e => setLinkTitle(e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder={'https://...'}
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={handleAddLink}
                disabled={isAddingLink || !linkTitle.trim() || !linkUrl.trim()}
              >
                {isAddingLink ? 'Добавление...' : 'Сохранить'}
              </button>
            </div>
          )}

          {showLibraryModal && (
            <LibraryPickerModal
              lessonId={lessonId}
              attachedKeys={new Set(lessonItems.map(i => resourceKey(i.resource_type, i.resource_id)))}
              onAttached={loadItems}
              onClose={() => setShowLibraryModal(false)}
            />
          )}

          <div className="toolbar">
            <h3 className="toolbar__title">{'Материалы урока'}</h3>
          </div>

          {itemsLoading && <p className="text-muted">{'Загрузка...'}</p>}
          {itemsError && <div className="error-text error-text--muted">{itemsError}</div>}
          {itemsNotice && <p className="text-muted">{itemsNotice}</p>}

          {!itemsLoading && itemsLoaded && (
            <>
              {/* Ширина по содержимому, прокрутка — только у таблицы и только
                  когда места действительно не хватает */}
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{'Тип'}</th>
                      <th>{'Название'}</th>
                      <th>{'Детали'}</th>
                      <th>{'Добавил'}</th>
                      <th className="table__col--date">{'Дата'}</th>
                      <th className="table__col--delete">{'Открепить'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessonItems.length === 0 ? (
                      <tr><td colSpan="6" className="table__empty">{'К уроку ничего не привязано'}</td></tr>
                    ) : (
                      lessonItems.map(item => {
                        const meta = TYPE_META[item.resource_type];
                        const key = resourceKey(item.resource_type, item.resource_id);
                        return (
                          <tr key={key} className={`table__row--${item.resource_type}`}>
                            <td>
                              <span className={`type-badge type-badge--${item.resource_type}`}>
                                {meta.icon} {subtypeLabel(item)}
                              </span>
                            </td>
                            <td>
                              <button type="button" className="link" onClick={() => handleOpenItem(item)} disabled={openingKey === key}>
                                {openingKey === key ? `${item.title} — открываем...` : item.title}
                              </button>
                            </td>
                            <td>
                              {item.resource_type === 'material' && (
                                <span className="nowrap">{formatSize(item.size_bytes || 0)}</span>
                              )}
                              {item.resource_type === 'quiz' && (
                                <span className="table__cell--truncate" data-tip={item.topic || ''}>{item.topic || '—'}</span>
                              )}
                              {item.resource_type === 'link' && (
                                <span className="table__cell--truncate" data-tip={item.url}>{item.url}</span>
                              )}
                            </td>
                            <td>{item.added_by_name || '—'}</td>
                            <td className="table__col--date nowrap">{item.added_at ? new Date(item.added_at).toLocaleDateString('ru-RU') : '—'}</td>
                            <td className="table__col--delete">
                              <button
                                type="button"
                                className="btn btn--sm"
                                onClick={() => handleDetachItem(item)}
                                disabled={detachingKey === key}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
                  {'Прошла полночь по Баку: присутствие и оценку за урок менять нельзя (отсутствующему можно отметить уважительную причину). Экзамен, звёзды, ДЗ и диалог — можно.'}
                </p>
              )}

              {marksRows.length > 0 && (
                <div className="button-row">
                  {!hwCheckMode && (
                    <button type="button" className="btn btn--outline" onClick={handleMarkAllPresent} disabled={isSavingAll || marksLocked}>
                      {'Все пришли'}
                    </button>
                  )}
                  <button type="button" className="btn btn--outline" onClick={() => setHwAddOpen(true)} data-tip="Добавить домашнее задание ВСЕМ">
                    {'+ ДЗ всем'}
                  </button>
                  {hwCheckMode ? (
                    <button type="button" className="btn" onClick={() => setHwCheckMode(false)}>
                      {'← Обычный вид'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn--outline" onClick={() => setHwCheckMode(true)} data-tip="Принять и оценить домашние задания">
                      {'Проверить ДЗ'}
                      {hwBoard.to_review > 0 && <span className="btn__count">{hwBoard.to_review}</span>}
                    </button>
                  )}
                </div>
              )}

              {hwCheckMode && (
                <HomeworkCheckView lessonId={lessonId} board={hwBoard} onChanged={loadHomework} onError={setMarksError} />
              )}

              {hwAddOpen && (
                <HomeworkAddModal
                  lessonId={lessonId}
                  student={null}
                  deadline={hwBoard.tasks.find(t => !t.student_id && t.deadline)?.deadline || null}
                  onChanged={loadHomework}
                  onClose={() => setHwAddOpen(false)}
                />
              )}

              {hwAddFor && (
                <HomeworkAddModal
                  lessonId={lessonId}
                  student={hwAddFor}
                  deadline={personalOrCommonDeadline(hwBoard, hwAddFor.student_id)}
                  onChanged={loadHomework}
                  onClose={() => setHwAddFor(null)}
                />
              )}

              {!hwCheckMode && (
              <div className="table-scroll">
                <table className="table table--fixed table--marks">
                  <thead>
                    <tr>
                      <th>{'Имя'}</th>
                      <th className="table__col--attendance">{'Посещаемость'}</th>
                      <th className="table__col--score">{'Оценка'}</th>
                      <th className="table__col--score">{'Экзамен'}</th>
                      <th className="table__col--stars">{'Звёзды'}</th>
                      <th className="table__col--flag">{'ДЗ'}</th>
                      <th className="table__col--flag">{'Ответ'}</th>
                      <th>{'Комментарий'}</th>
                      <th className="table__col--icons">{'Контакты'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksRows.length === 0 ? (
                      <tr><td colSpan="9" className="table__empty">{'В группе нет студентов'}</td></tr>
                    ) : (
                      marksRows.map(row => {
                        const hwRow = hwBoard.students.find(h => h.student_id === row.student_id);
                        return (
                          <tr key={row.student_id} className={hwRow?.answer.status === 'submitted' ? 'table__row--homework-pending' : undefined}>
                            <td>{row.full_name}</td>
                            <td>
                              <div className="attendance-group">
                                {ATTENDANCE_STATUS_BUTTONS.map(btn => (
                                  <button
                                    key={btn.kind}
                                    type="button"
                                    className={`attendance-btn attendance-btn--${btn.kind}${row.attendance_status === btn.status ? ' attendance-btn--active' : ''}`}
                                    data-tip={btn.label}
                                    disabled={marksLocked && !(btn.kind === 'excused' && !LATE_STATUSES.has(row.attendance_status))}
                                    onClick={() => handleAttendanceClick(row.student_id, btn)}
                                  />
                                ))}
                                <button
                                  type="button"
                                  className={`attendance-btn attendance-btn--late${row.is_late ? ' attendance-btn--active' : ''}`}
                                  data-tip={'Опоздал'}
                                  disabled={marksLocked || !LATE_STATUSES.has(row.attendance_status)}
                                  onClick={() => handleLateToggle(row.student_id)}
                                />
                              </div>
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
                                onBlur={() => handleScoreBlur(row.student_id)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="input input--sm-num"
                                value={row.exam_score}
                                onChange={e => updateRowField(row.student_id, 'exam_score', e.target.value)}
                                onBlur={() => handleExamScoreBlur(row.student_id)}
                              />
                            </td>
                            <td>
                              <div className="star-picker">
                                {[1, 2, 3].map(n => (
                                  <button
                                    key={n}
                                    type="button"
                                    className={`star-picker__btn${row.stars >= n ? ' star-picker__btn--active' : ''}`}
                                    onClick={() => handleStarsClick(row.student_id, n)}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </td>
                            <HomeworkFlags row={hwRow} onAdd={setHwAddFor} />
                            <td>
                              {/* Диалог педагог ↔ студент (вместо комментария); полуночная блокировка на него не действует */}
                              <DialogCell
                                lessonId={lessonId}
                                studentId={row.student_id}
                                studentName={row.full_name}
                                lastMessage={hwRow?.last_message}
                                count={hwRow?.messages_count || 0}
                                onChanged={loadHomework}
                              />
                              {rowErrors[row.student_id] && (
                                <div className="error-text--sm">{rowErrors[row.student_id]}</div>
                              )}
                            </td>
                            <td>
                              <StudentContactIcons telegram={row.telegram_username} whatsapp={row.whatsapp} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}

            </>
          )}
        </div>
      )}

      <label className="field-label field-label--top-gap">
        {'Комментарий к уроку'}
        <textarea
          className="input input--textarea"
          value={lessonComment}
          onChange={e => setLessonComment(e.target.value)}
          onBlur={handleCommitComment}
          disabled={isSavingComment}
          placeholder={'Заметки педагога по уроку в целом — что обсудили, на что обратить внимание в следующий раз...'}
        />
        {isSavingComment && <span className="hint-text">{'Сохранение…'}</span>}
      </label>
    </div>
  );
}

export default LessonPage;
