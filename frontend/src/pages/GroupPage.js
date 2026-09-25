import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import QRModal from '../components/QRModal';
import StudentsModal from '../components/StudentsModal';
import Calendar from '../components/Calendar';
import { useLang } from '../hooks/useLang';
import { getMyGroups, getCourses } from '../api/groups';
import {
  getGroupLessons, createLesson, generateSchedule,
  fillGroupSchedule, deleteGroupLessons, markLessonHoliday,
} from '../api/lessons';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']; // 0..6, как в date.weekday() на бэке

function GroupPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const gid = parseInt(groupId);

  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLessonDate, setNewLessonDate] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const { lang } = useLang(); // автоназвания «Урок N» — на языке интерфейса педагога
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [rangeFilter, setRangeFilter] = useState('upcoming'); // upcoming | week | month | all

  // Таблица/Календарь — выбор запоминается в localStorage, как и фильтры
  // на /dashboard/groups (см. GroupsPage.js).
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('la_group_viewmode') || 'table'); // table | calendar
  useEffect(() => {
    localStorage.setItem('la_group_viewmode', viewMode);
  }, [viewMode]);

  // Генератор расписания (claude/group-schedule-plan.md, задача 1)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genStartTime, setGenStartTime] = useState('14:00');
  const [genWeekdays, setGenWeekdays] = useState([]); // 0..6
  const [genLessonCount, setGenLessonCount] = useState('');
  const [genFillSource, setGenFillSource] = useState(''); // '' | template | group
  const [genFillGroupId, setGenFillGroupId] = useState('');
  const [genError, setGenError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Диалог решения, если в группе уже есть уроки — см. handleOpenScheduleFlow
  const [isExistingLessonsDialogOpen, setIsExistingLessonsDialogOpen] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);

  // Дозаполнение/обновление материалов уже существующих уроков — и как
  // шаг после решения "уроки уже есть", и как отдельная кнопка
  const [isFillModalOpen, setIsFillModalOpen] = useState(false);
  const [fillSource, setFillSource] = useState('template'); // template | group
  const [fillGroupId, setFillGroupId] = useState('');
  const [fillRangeFrom, setFillRangeFrom] = useState('');
  const [fillRangeTo, setFillRangeTo] = useState('');
  const [fillMode, setFillMode] = useState('add'); // add (Дополнить) | replace (Заменить)
  const [isFilling, setIsFilling] = useState(false);
  const [fillError, setFillError] = useState('');

  const [markingHolidayId, setMarkingHolidayId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [lessonsRes, groupsRes, coursesRes] = await Promise.all([
          getGroupLessons(gid),
          getMyGroups(),
          getCourses(),
        ]);
        setLessons(lessonsRes);
        setGroups(groupsRes);
        setCourses(coursesRes);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Не удалось загрузить группу');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line
  }, [gid]);

  const group = groups.find(g => g.id === gid);
  const courseName = courses.find(c => c.id === group?.course_id)?.title || '—';

  // Уроки только этой группы. По умолчанию — с сегодня и далее; кнопками
  // «Неделя»/«Месяц»/«Все» нижняя граница отодвигается назад (в прошлое),
  // будущие уроки при этом видны всегда — верхней границы нет никогда.
  const startOfWeek = (d) => {
    // Неделя с понедельника (getDay(): 0 — воскресенье)
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const startOfMonth = (d) => {
    const date = new Date(d.getFullYear(), d.getMonth(), 1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const visible = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let lowerBound = today;
    if (rangeFilter === 'week') lowerBound = startOfWeek(today);
    else if (rangeFilter === 'month') lowerBound = startOfMonth(today);
    else if (rangeFilter === 'all') lowerBound = null;

    return lessons
      .filter(l => l.group_id === gid)
      .filter(l => !l.date || lowerBound === null || new Date(l.date) >= lowerBound)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [lessons, gid, rangeFilter]);

  // Для календаря — все уроки группы без обрезки по «с сегодня»: там
  // своя навигация вперёд/назад по месяцу/неделе, обрезка не нужна и
  // только мешала бы смотреть прошлое.
  const groupLessons = useMemo(
    () => lessons.filter(l => l.group_id === gid),
    [lessons, gid]
  );

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  };

  const openCreateModal = () => {
    setCreateError('');
    setNewLessonDate('');
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setCreateError('');
    setIsCreating(false);
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!newLessonDate) {
      setCreateError('Укажите дату и время начала урока');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const payload = {
        group_id: gid,
        lang,
        date: new Date(newLessonDate).toISOString(),
      };
      const created = await createLesson(payload);
      setLessons(prev => [...prev, created]);
      closeCreateModal();
    } catch (err) {
      setCreateError(err?.response?.data?.detail || 'Не удалось создать урок');
      setIsCreating(false);
    }
  };

  // "Заполнить расписание" — если в группе уже есть уроки, сперва
  // спрашиваем: удалить и пересоздать заново или оставить даты как есть и
  // просто дозаполнить материалами (см. ответ Андрея в group-schedule-plan.md).
  const handleOpenScheduleFlow = () => {
    setGenError('');
    const hasLessons = lessons.some(l => l.group_id === gid);
    if (hasLessons) {
      setIsExistingLessonsDialogOpen(true);
    } else {
      openGenerateModal();
    }
  };

  const openGenerateModal = () => {
    setGenStartDate('');
    setGenStartTime('14:00');
    setGenWeekdays([]);
    setGenLessonCount('');
    setGenFillSource('');
    setGenFillGroupId('');
    setGenError('');
    setIsGenerateModalOpen(true);
  };

  const toggleGenWeekday = (day) => {
    setGenWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleRecreateSchedule = async () => {
    setIsRecreating(true);
    setError('');
    try {
      await deleteGroupLessons(gid);
      setLessons(prev => prev.filter(l => l.group_id !== gid));
      setIsExistingLessonsDialogOpen(false);
      openGenerateModal();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось удалить уроки группы');
    } finally {
      setIsRecreating(false);
    }
  };

  const handleChooseFillInstead = () => {
    setIsExistingLessonsDialogOpen(false);
    openFillModal();
  };

  const handleGenerateSchedule = async (e) => {
    e.preventDefault();
    if (!genStartDate || !genStartTime || genWeekdays.length === 0 || !genLessonCount) {
      setGenError('Заполните дату начала, время, дни недели и количество уроков');
      return;
    }
    if (genFillSource === 'group' && !genFillGroupId) {
      setGenError('Выберите группу-источник материалов');
      return;
    }

    setIsGenerating(true);
    setGenError('');
    try {
      const payload = {
        group_id: gid,
        start_date: genStartDate,
        start_time: genStartTime,
        weekdays: genWeekdays,
        lesson_count: parseInt(genLessonCount, 10),
        lang,
      };
      if (genFillSource) {
        payload.fill_source = genFillSource;
        if (genFillSource === 'group') payload.fill_group_id = parseInt(genFillGroupId, 10);
      }
      const created = await generateSchedule(payload);
      setLessons(prev => [...prev, ...created]);
      setIsGenerateModalOpen(false);
    } catch (err) {
      setGenError(err?.response?.data?.detail || 'Не удалось сгенерировать расписание');
    } finally {
      setIsGenerating(false);
    }
  };

  // «Обновить материалы» — источник (шаблон курса группы / другая группа),
  // диапазон уроков, режим Дополнить/Заменить. См. course-templates-plan.md.
  const openFillModal = () => {
    const groupLessonsCount = lessons.filter(l => l.group_id === gid).length;
    setFillSource('template');
    setFillGroupId('');
    setFillRangeFrom('1');
    setFillRangeTo(String(groupLessonsCount || 1));
    setFillMode('add');
    setFillError('');
    setIsFillModalOpen(true);
  };

  const handleFillSchedule = async (e) => {
    e.preventDefault();
    if (!fillRangeFrom || !fillRangeTo) {
      setFillError('Укажите диапазон уроков');
      return;
    }
    if (fillSource === 'group' && !fillGroupId) {
      setFillError('Выберите группу-источник');
      return;
    }

    setIsFilling(true);
    setFillError('');
    try {
      const payload = {
        source: fillSource,
        range_from: parseInt(fillRangeFrom, 10),
        range_to: parseInt(fillRangeTo, 10),
        mode: fillMode,
      };
      if (fillSource === 'group') payload.fill_group_id = parseInt(fillGroupId, 10);
      await fillGroupSchedule(gid, payload);
      setIsFillModalOpen(false);
    } catch (err) {
      setFillError(err?.response?.data?.detail || 'Не удалось обновить материалы');
    } finally {
      setIsFilling(false);
    }
  };

  // «Праздник» — сдвигает этот и все последующие уроки серии на одну
  // позицию вперёд (материалы/оценки не трогает), см. lessons.py.
  const handleMarkHoliday = async (lesson) => {
    const dateLabel = lesson.date ? new Date(lesson.date).toLocaleDateString('ru-RU') : '—';
    const confirmed = window.confirm(
      `Отметить «${lesson.title}» (${dateLabel}) как выходной для этой группы? Этот и все последующие уроки серии сдвинутся на одну позицию вперёд.`
    );
    if (!confirmed) return;

    setMarkingHolidayId(lesson.id);
    setError('');
    try {
      const updated = await markLessonHoliday(lesson.id);
      const updatedById = new Map(updated.map(l => [l.id, l]));
      setLessons(prev => prev.map(l => updatedById.get(l.id) || l));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось отметить праздник');
    } finally {
      setMarkingHolidayId(null);
    }
  };

  if (loading) return <div className="page page--group">{'Загрузка...'}</div>;

  if (!group) {
    return (
      <div className="page page--group">
        <button className="btn btn--outline" onClick={() => navigate('/dashboard')}>
          {'Назад'}
        </button>
        <div className="error-text error-text--muted">
          {'Группа не найдена'}
        </div>
      </div>
    );
  }

  return (
    <div className="page page--group">
      <button className="btn btn--outline" onClick={() => navigate('/dashboard')}>
        {'Назад'}
      </button>

      {/* Шапка группы */}
      <div className="group-header">
        <div>
          <h2 className="group-header__title">{group.name}</h2>
          <div className="meta-row">
            <span>{'Курс'}: <b>{courseName}</b></span>
            <span>·</span>
            <span>{'Преподаватель'}: <b>{group.teacher_name || '—'}</b></span>
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--info btn--compact" onClick={() => setIsQRModalOpen(true)}>
            {'QR для регистрации'}
          </button>
          <button className="btn btn--compact" onClick={() => setIsStudentsModalOpen(true)}>
            {'Ученики'} ({group.student_count ?? 0})
          </button>
        </div>
      </div>

      {/* Тулбар уроков */}
      <div className="toolbar">
        <h3 className="toolbar__title">{'Уроки'}</h3>
        <div className="button-row">
          <button className="btn" onClick={openCreateModal}>
            {'+ Урок'}
          </button>
          <button className="btn btn--outline" onClick={handleOpenScheduleFlow}>
            {'Заполнить расписание'}
          </button>
          <button className="btn btn--outline" onClick={openFillModal}>
            {'Обновить материалы'}
          </button>
        </div>
      </div>

      <div className="toolbar__filters">
        <button
          type="button"
          className={`tab${viewMode === 'table' ? ' tab--active' : ''}`}
          onClick={() => setViewMode('table')}
        >
          {'Таблица'}
        </button>
        <button
          type="button"
          className={`tab${viewMode === 'calendar' ? ' tab--active' : ''}`}
          onClick={() => setViewMode('calendar')}
        >
          {'Календарь'}
        </button>
      </div>

      {viewMode === 'table' && (
        <div className="toolbar__filters">
          {[
            { key: 'upcoming', label: 'С сегодня' },
            { key: 'week', label: 'С начала недели' },
            { key: 'month', label: 'С начала месяца' },
            { key: 'all', label: 'Все уроки' },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`tab tab--underline${rangeFilter === opt.key ? ' tab--active' : ''}`}
              onClick={() => setRangeFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error-text error-text--top">{error}</div>}

      {viewMode === 'calendar' ? (
        <Calendar
          lessons={groupLessons}
          onSelectLesson={(l) => navigate(`/dashboard/lessons/${l.id}`)}
        />
      ) : (
        /* Таблица уроков */
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{'Дата'}</th>
                <th>{'Тема урока'}</th>
                <th>{'Доступ'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="table__empty">
                    {'Уроков нет'}
                  </td>
                </tr>
              )}
              {visible.map(l => {
                const today = isToday(l.date);
                return (
                  <tr
                    key={l.id}
                    className={`table__row--clickable${today ? ' table__row--today' : ''}${l.has_unreviewed_homework ? ' table__row--homework-pending' : ''}`}
                    onClick={() => navigate(`/dashboard/lessons/${l.id}`)}
                  >
                    <td>
                      {l.date ? new Date(l.date).toLocaleDateString('ru-RU') : '—'}
                      {today && <span className="badge badge--today badge--inline">{'Сегодня'}</span>}
                    </td>
                    <td>
                      {l.title}
                      {l.has_unreviewed_homework && (
                        <span className="badge badge--homework-pending badge--inline" data-tip={'Есть непроверенные решения ДЗ'}>
                          {'ДЗ: проверить'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${l.is_open ? 'badge--open' : 'badge--closed'}`}>
                        {l.is_open ? 'Открыт' : 'Закрыт'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        data-tip={'Отметить праздником — сдвинуть эту и следующие даты'}
                        onClick={(e) => { e.stopPropagation(); handleMarkHoliday(l); }}
                        disabled={markingHolidayId === l.id}
                      >
                        {'🎉'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка создания урока */}
      {isModalOpen && (
        <Modal
          title={'Новый урок'}
          onClose={closeCreateModal}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={closeCreateModal}>
                {'Отмена'}
              </button>
              <button type="submit" form="new-lesson-form" className="btn" disabled={isCreating}>
                {isCreating ? 'Сохранение...' : 'Создать'}
              </button>
            </>
          )}
        >
          <form id="new-lesson-form" onSubmit={handleCreateLesson} className="form-stack">
            <label className="field-label">
              {'Дата и время начала'}
              <input
                type="datetime-local"
                className="input"
                value={newLessonDate}
                onChange={e => setNewLessonDate(e.target.value)}
                required
              />
            </label>

            {createError && <div className="form-field__error">{createError}</div>}
          </form>
        </Modal>
      )}

      {/* В группе уже есть уроки — выбор действия перед генерацией */}
      {isExistingLessonsDialogOpen && (
        <Modal
          title={'В группе уже есть уроки'}
          onClose={() => setIsExistingLessonsDialogOpen(false)}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setIsExistingLessonsDialogOpen(false)}>
              {'Отмена'}
            </button>
          )}
        >
          <div className="form-stack">
            <p>{'Что сделать с уже существующим расписанием этой группы?'}</p>
            <button type="button" className="btn" onClick={handleRecreateSchedule} disabled={isRecreating}>
              {isRecreating ? 'Удаление...' : 'Удалить и создать заново'}
            </button>
            <button type="button" className="btn btn--outline" onClick={handleChooseFillInstead}>
              {'Оставить даты — дозаполнить материалами'}
            </button>
          </div>
        </Modal>
      )}

      {/* Генератор расписания — claude/group-schedule-plan.md, задача 1 */}
      {isGenerateModalOpen && (
        <Modal
          title={'Заполнить расписание'}
          onClose={() => setIsGenerateModalOpen(false)}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setIsGenerateModalOpen(false)}>
                {'Отмена'}
              </button>
              <button type="submit" form="generate-schedule-form" className="btn" disabled={isGenerating}>
                {isGenerating ? 'Создание...' : 'Создать уроки'}
              </button>
            </>
          )}
        >
          <form id="generate-schedule-form" onSubmit={handleGenerateSchedule} className="form-stack">
            <label className="field-label">
              {'Дата первого урока'}
              <input
                type="date"
                className="input"
                value={genStartDate}
                onChange={e => setGenStartDate(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              {'Время (одно на все уроки)'}
              <input
                type="time"
                className="input"
                value={genStartTime}
                onChange={e => setGenStartTime(e.target.value)}
                required
              />
            </label>
            <div className="field-label">
              {'Дни недели'}
              <div className="button-row">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    type="button"
                    key={day}
                    className={`tab${genWeekdays.includes(day) ? ' tab--active' : ''}`}
                    onClick={() => toggleGenWeekday(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-label">
              {'Количество уроков'}
              <input
                type="number"
                min="1"
                max="200"
                className="input input--sm-num"
                value={genLessonCount}
                onChange={e => setGenLessonCount(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              {'Материалы'}
              <select className="input" value={genFillSource} onChange={e => setGenFillSource(e.target.value)}>
                <option value="">{'Не заполнять сейчас'}</option>
                <option value="template">{'Из шаблона курса группы'}</option>
                <option value="group">{'Из другой группы'}</option>
              </select>
            </label>
            {genFillSource === 'group' && (
              <label className="field-label">
                {'Группа-источник'}
                <select className="input" value={genFillGroupId} onChange={e => setGenFillGroupId(e.target.value)}>
                  <option value="">{'— Группа —'}</option>
                  {groups.filter(g => g.id !== gid).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
            )}

            {genError && <div className="form-field__error">{genError}</div>}
          </form>
        </Modal>
      )}

      {/* Дозаполнение/обновление материалов — course-templates-plan.md */}
      {isFillModalOpen && (
        <Modal
          title={'Обновить материалы уроков'}
          onClose={() => setIsFillModalOpen(false)}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setIsFillModalOpen(false)}>
                {'Отмена'}
              </button>
              <button type="submit" form="fill-schedule-form" className="btn" disabled={isFilling}>
                {isFilling ? 'Обновление...' : 'Обновить'}
              </button>
            </>
          )}
        >
          <form id="fill-schedule-form" onSubmit={handleFillSchedule} className="form-stack">
            <label className="field-label">
              {'Источник материалов'}
              <select className="input" value={fillSource} onChange={e => setFillSource(e.target.value)}>
                <option value="template">{'Шаблон курса группы'}</option>
                <option value="group">{'Другая группа'}</option>
              </select>
            </label>
            {fillSource === 'group' && (
              <label className="field-label">
                {'Группа-источник'}
                <select className="input" value={fillGroupId} onChange={e => setFillGroupId(e.target.value)}>
                  <option value="">{'— Группа —'}</option>
                  {groups.filter(g => g.id !== gid).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="button-row">
              <label className="field-label">
                {'Урок с №'}
                <input
                  type="number"
                  min="1"
                  className="input input--sm-num"
                  value={fillRangeFrom}
                  onChange={e => setFillRangeFrom(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                {'по №'}
                <input
                  type="number"
                  min="1"
                  className="input input--sm-num"
                  value={fillRangeTo}
                  onChange={e => setFillRangeTo(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="field-label">
              {'Режим'}
              <select className="input" value={fillMode} onChange={e => setFillMode(e.target.value)}>
                <option value="add">{'Дополнить — добавить только недостающее'}</option>
                <option value="replace">{'Заменить — сначала отвязать всё текущее'}</option>
              </select>
            </label>

            {fillError && <div className="form-field__error">{fillError}</div>}
          </form>
        </Modal>
      )}

      {isQRModalOpen && (
        <QRModal
          group={group}
          onClose={() => setIsQRModalOpen(false)}
          onAdded={() => setGroups(gs => gs.map(g => (g.id === gid ? { ...g, student_count: (g.student_count || 0) + 1 } : g)))}
        />
      )}

      {isStudentsModalOpen && (
        <StudentsModal
          groupId={gid}
          groupName={group.name}
          onClose={() => setIsStudentsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default GroupPage;
