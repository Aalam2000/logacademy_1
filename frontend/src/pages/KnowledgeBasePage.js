import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import DeleteButton from '../components/DeleteButton';
import IconButton from '../components/IconButton';
import { getCourses } from '../api/admin';
import { uploadMaterial, updateMaterialTemplate, bulkUpdateMaterialTemplate } from '../api/materials';
import { useAuth } from '../context/AuthContext';
import { TYPE_META, formatSize, subtypeLabel, resourceKey, needsPdfPreview } from '../utils/libraryItems';
import { IconBadgeFile, IconBadgeQuiz, IconBadgeLink } from '../components/TypeBadgeIcons';
function itemKey(item) {
  return resourceKey(item.resource_type, item.id);
}
// Иконка по типу ресурса — SVG в стиле бейджа (белая, 12×12).
function BadgeIcon({ type }) {
  if (type === 'material') return <IconBadgeFile className="type-badge__icon" />;
  if (type === 'quiz') return <IconBadgeQuiz className="type-badge__icon" />;
  if (type === 'link') return <IconBadgeLink className="type-badge__icon" />;
  return null;
}
function KnowledgeBasePage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasRole('admin');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' | material | quiz | link
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState('date'); // date | title
  const [openingKey, setOpeningKey] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // "Загрузить курс" — массовая загрузка папки как шаблона курса (только
  // admin). См. claude/course-templates-plan.md.
  const [showCourseUpload, setShowCourseUpload] = useState(false);
  const [courses, setCourses] = useState([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [courseSector, setCourseSector] = useState('');
  const [courseRows, setCourseRows] = useState([]); // [{file, relPath, lessonNo}]
  const [isUploadingCourse, setIsUploadingCourse] = useState(false);
  const [courseUploadProgress, setCourseUploadProgress] = useState(null); // {done, total, failed}
  const [courseUploadError, setCourseUploadError] = useState('');
  const courseFolderInputRef = useRef(null);

  // Фильтры по курсу/сектору в базе знаний — только admin, для проверки/
  // утверждения пакета шаблонных материалов. См. course-templates-plan.md.
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [bulkTemplateSaving, setBulkTemplateSaving] = useState(false);
  const [savingTemplateKey, setSavingTemplateKey] = useState(null);

  // Материалы шаблонов уроков курса по умолчанию скрыты — мешают в
  // обычной работе с БЗ; этот флажок их показывает (см. library.py).
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line
  }, [typeFilter, onlyMine, sort, filterCourseId, filterSector, showTemplates]);

  useEffect(() => {
    if (isAdmin) ensureCoursesLoaded();
    // eslint-disable-next-line
  }, [isAdmin]);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort };
      if (typeFilter) params.type = typeFilter;
      if (onlyMine && user) params.uploader = user.id;
      if (isAdmin && filterCourseId) params.course_id = filterCourseId;
      if (isAdmin && filterSector) params.sector = filterSector;
      if (showTemplates) params.include_templates = true;
      const res = await api.get('/library/items', { params });
      setItems(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить базу знаний');
    } finally {
      setLoading(false);
    }
  };

  // Кнопка сама открывает системный проводник (клик по скрытому input) —
  // выбор файла сразу запускает загрузку, без промежуточного шага.
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    try {
      try {
        await uploadMaterial(file);
      } catch (err) {
        // Одноимённый файл с другим содержимым — только после подтверждения
        const data = err?.response?.data;
        if (err?.response?.status !== 409 || data?.code !== 'same_name' || !window.confirm(data.detail)) throw err;
        await uploadMaterial(file, undefined, true);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadItems();
    } catch (err) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(err?.response?.data?.detail || 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    setIsAddingLink(true);
    setError('');
    try {
      await api.post('/links/', { title: linkTitle.trim(), url: linkUrl.trim() });
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось добавить ссылку');
    } finally {
      setIsAddingLink(false);
    }
  };

  // Номер урока из имени файла: "Урок 5.2 — ....html" -> "5.2",
  // "Урок 5.docx" -> "5". Папка вокруг файла (её название) не участвует —
  // источник номера всегда само имя файла. Не распознано — пусто,
  // admin вводит вручную в предпросмотре (загрузка ничего не блокирует).
  const parseLessonNo = (filename) => {
    const m = filename.match(/урок\s*№?\s*(\d+)(?:[.\-_](\d+))?/i);
    if (!m) return '';
    return m[2] ? `${m[1]}.${m[2]}` : m[1];
  };

  // Список курсов нужен и загрузчику, и фильтрам БЗ — грузим один раз.
  const ensureCoursesLoaded = async () => {
    if (coursesLoaded) return;
    try {
      const data = await getCourses();
      setCourses(data);
      setCoursesLoaded(true);
    } catch (err) {
      setCourseUploadError(err?.response?.data?.detail || 'Не удалось загрузить список курсов');
    }
  };

  const handleOpenCourseUpload = () => {
    setShowCourseUpload(v => !v);
    setCourseUploadError('');
    ensureCoursesLoaded();
  };

  const handleCourseFolderSelected = (e) => {
    const files = Array.from(e.target.files || []);
    const rows = files.map(file => ({
      file,
      relPath: file.webkitRelativePath || file.name,
      lessonNo: parseLessonNo(file.name),
    }));
    setCourseRows(rows);
    setCourseUploadProgress(null);
    setCourseUploadError('');
  };

  const updateCourseRowLessonNo = (index, value) => {
    setCourseRows(prev => prev.map((row, i) => i === index ? { ...row, lessonNo: value } : row));
  };

  const handleConfirmCourseUpload = async () => {
    if (!courseId || !courseSector || courseRows.length === 0) return;
    setIsUploadingCourse(true);
    setCourseUploadError('');
    const total = courseRows.length;
    let done = 0;
    let failed = 0;
    setCourseUploadProgress({ done, total, failed });
    for (const row of courseRows) {
      try {
        await uploadMaterial(row.file, {
          course_id: courseId,
          sector: courseSector,
          template_lesson_no: row.lessonNo.trim() || null,
        });
      } catch (err) {
        failed += 1;
      }
      done += 1;
      setCourseUploadProgress({ done, total, failed });
    }
    setIsUploadingCourse(false);
    if (failed === 0) {
      setCourseRows([]);
      setCourseId('');
      setCourseSector('');
      setShowCourseUpload(false);
      if (courseFolderInputRef.current) courseFolderInputRef.current.value = '';
    } else {
      setCourseUploadError(`Загружено ${total - failed} из ${total}, ${failed} файл(ов) — с ошибкой (см. список выше)`);
    }
    loadItems();
  };

  // Окно под файл/квиз открываем сразу, синхронно по клику — если открыть
  // его уже после await, браузер считает это всплывающим окном не по
  // действию пользователя и блокирует.
  const handleOpen = async (item) => {
    setError('');

    if (item.resource_type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const key = itemKey(item);
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
        const res = await api.get(`/materials/${item.id}/${endpoint}`, { responseType: 'blob' });
        const fallbackType = endpoint === 'preview' ? 'application/pdf' : (item.content_type || 'application/octet-stream');
        const type = res.headers?.['content-type'] || fallbackType;
        const url = window.URL.createObjectURL(new Blob([res.data], { type }));
        const openUrl = type === 'application/pdf' ? `${url}#navpanes=0` : url;
        if (win) win.location.href = openUrl;
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const res = await api.get(`/quizzes/${item.id}/html`);
        if (win) {
          win.document.write(res.data.html);
          win.document.close();
        }
      }
    } catch (err) {
      if (win) win.close();
      setError(err?.response?.data?.detail || 'Не удалось открыть');
    } finally {
      setOpeningKey(null);
    }
  };

  // Массовое решение по всему пакету материалов курса+сектора (оба фильтра
  // должны быть выбраны) — см. course-templates-plan.md.
  const handleBulkTemplateStatus = async (status) => {
    if (!filterCourseId || !filterSector) return;
    setBulkTemplateSaving(true);
    setError('');
    try {
      await bulkUpdateMaterialTemplate({ course_id: filterCourseId, sector: filterSector, template_status: status });
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось обновить статус пакета');
    } finally {
      setBulkTemplateSaving(false);
    }
  };

  // Решение по одному файлу — независимо от массового.
  const handleSetMaterialTemplateStatus = async (item, status) => {
    const key = itemKey(item);
    setSavingTemplateKey(key);
    setError('');
    try {
      await updateMaterialTemplate(item.id, { template_status: status });
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось обновить статус');
    } finally {
      setSavingTemplateKey(null);
    }
  };

  // Право удалять (где используется — проверяет сама DeleteButton)
  const canDelete = (item) => {
    if (item.resource_type === 'quiz') return isAdmin || item.uploaded_by === user?.id;
    return isAdmin; // файлы и ссылки — только admin
  };

  const DELETE_PATH = { material: 'materials', quiz: 'quizzes', link: 'links' };
  const DELETE_TIP = { material: 'Удалить файл', quiz: 'Удалить квиз', link: 'Удалить ссылку' };

  const columnCount = 8;

  return (
    <div className="page">
      <div className="toolbar toolbar--underline-row">
        <div className="toolbar__filters">
          <button type="button" className={`tab tab--underline${typeFilter === '' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('')}>
            {'Все'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'material' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('material')}>
            {'Файлы'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'link' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('link')}>
            {'Ссылки'}
          </button>
          <button type="button" className={`tab tab--underline${typeFilter === 'quiz' ? ' tab--active' : ''}`} onClick={() => setTypeFilter('quiz')}>
            {'Квизы'}
          </button>
        </div>
        <div className="toolbar__filters">
          <button type="button" className={`tab tab--underline${onlyMine ? ' tab--active' : ''}`} onClick={() => setOnlyMine(v => !v)}>
            {'Моё'}
          </button>
          <label className="checkbox-row">
            <input type="checkbox" checked={showTemplates} onChange={e => setShowTemplates(e.target.checked)} />
            {'Показывать материалы из шаблонов уроков'}
          </label>
          {isAdmin && (
            <>
              <select className="input input--min160" value={filterCourseId} onChange={e => setFilterCourseId(e.target.value)}>
                <option value="">{'Курс: все'}</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select className="input input--min160" value={filterSector} onChange={e => setFilterSector(e.target.value)}>
                <option value="">{'Сектор: все'}</option>
                <option value="ru">{'Русский сектор'}</option>
                <option value="az">{'Azərbaycan sektoru'}</option>
              </select>
            </>
          )}
          <select className="input" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="date">{'По дате'}</option>
            <option value="title">{'По названию'}</option>
          </select>
        </div>
      </div>

      {isAdmin && filterCourseId && filterSector && (
        <div className="form-toolbar">
          <span>{'Пакет материалов курса — решение разом:'}</span>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => handleBulkTemplateStatus('approved')} disabled={bulkTemplateSaving}>
            {'Одобрить пакет'}
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => handleBulkTemplateStatus('rejected')} disabled={bulkTemplateSaving}>
            {'Заблокировать пакет'}
          </button>
        </div>
      )}

      <div className="form-toolbar">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          hidden
        />
        <button type="button" className="btn" onClick={handlePickFile} disabled={isUploading}>
          {isUploading ? 'Загрузка...' : 'Загрузить файл'}
        </button>
        <button type="button" className="btn btn--outline" onClick={() => setShowLinkForm(v => !v)}>
          {'+ Добавить ссылку'}
        </button>
        <button type="button" className="btn btn--outline" onClick={() => navigate('/dashboard/add-quiz')}>
          {'+ Создать квиз'}
        </button>
        {isAdmin && (
          <button type="button" className="btn btn--outline" onClick={handleOpenCourseUpload}>
            {'Загрузить курс'}
          </button>
        )}
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

      {isAdmin && showCourseUpload && (
        <div>
          <div className="form-toolbar">
            <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">{'Курс...'}</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select className="input" value={courseSector} onChange={e => setCourseSector(e.target.value)}>
              <option value="">{'Направление...'}</option>
              <option value="ru">{'Русский сектор'}</option>
              <option value="az">{'Azərbaycan sektoru'}</option>
            </select>
            <input
              type="file"
              ref={courseFolderInputRef}
              onChange={handleCourseFolderSelected}
              webkitdirectory="true"
              directory="true"
              multiple
              hidden
            />
            <button type="button" className="btn" onClick={() => courseFolderInputRef.current?.click()}>
              {'Выбрать папку курса'}
            </button>
          </div>

          {courseRows.length > 0 && (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{'Файл'}</th>
                      <th>{'Номер урока'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseRows.map((row, i) => (
                      <tr key={row.relPath + i}>
                        <td className="table__cell--truncate" data-tip={row.relPath}>{row.relPath}</td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={row.lessonNo}
                            placeholder={'не распознано'}
                            onChange={e => updateCourseRowLessonNo(i, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-toolbar">
                <button
                  type="button"
                  className="btn"
                  onClick={handleConfirmCourseUpload}
                  disabled={!courseId || !courseSector || isUploadingCourse}
                >
                  {isUploadingCourse
                    ? `Загрузка ${courseUploadProgress?.done ?? 0} из ${courseUploadProgress?.total ?? courseRows.length}...`
                    : `Загрузить ${courseRows.length} файл(ов)`}
                </button>
              </div>
            </>
          )}

          {courseUploadError && <div className="error-text error-text--muted">{courseUploadError}</div>}
        </div>
      )}

      {error && <div className="error-text error-text--muted">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Тип'}</th>
              <th>{'Название'}</th>
              <th>{'Детали'}</th>
              <th>{'Загрузил'}</th>
              <th>{'Дата'}</th>
              <th>{'В уроках'}</th>
              <th>{'Статус'}</th>
              <th>{'Удалить'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table__empty">{'Загрузка...'}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={columnCount} className="table__empty">{'В базе знаний пока пусто'}</td></tr>
            ) : (
              items.map(item => {
                const meta = TYPE_META[item.resource_type];
                const key = itemKey(item);
                const deletable = canDelete(item);
                return (
                  <tr key={key} className={`table__row--${item.resource_type}`}>
                    <td>
                      <span className={`type-badge type-badge--${item.resource_type}`}>
                        <BadgeIcon type={item.resource_type} />
                        {subtypeLabel(item)}
                      </span>
                      {item.is_homework && (
                        <span className="badge badge--homework badge--inline" data-tip={'Используется как ДЗ в уроке'}>{'ДЗ'}</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="link" onClick={() => handleOpen(item)} disabled={openingKey === key}>
                        {openingKey === key ? `${item.title} — открываем...` : item.title}
                      </button>
                    </td>
                    <td className="nowrap">
                      {item.resource_type === 'material' && formatSize(item.size_bytes || 0)}
                      {item.resource_type === 'quiz' && (item.topic || '—')}
                      {item.resource_type === 'link' && (
                        <span className="table__cell--truncate" data-tip={item.url}>{item.url}</span>
                      )}
                    </td>
                    <td>{item.uploaded_by_name || '—'}</td>
                    <td className="nowrap">{new Date(item.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="nowrap">{item.attached_lessons_count > 0 ? item.attached_lessons_count : '—'}</td>
                    <td className="nowrap">
                      {isAdmin && item.resource_type === 'material' && item.template_lesson_no ? (
                        <>
                          {item.template_status === 'approved' ? 'Одобрено'
                            : item.template_status === 'rejected' ? 'Отклонено'
                            : 'На проверке'}
                          {' '}
                          <button
                            type="button"
                            className="btn btn--sm"
                            data-tip={'Одобрить'}
                            onClick={() => handleSetMaterialTemplateStatus(item, 'approved')}
                            disabled={savingTemplateKey === key || item.template_status === 'approved'}
                          >
                            {'✅'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm"
                            data-tip={'Заблокировать'}
                            onClick={() => handleSetMaterialTemplateStatus(item, 'rejected')}
                            disabled={savingTemplateKey === key || item.template_status === 'rejected'}
                          >
                            {'🚫'}
                          </button>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      {deletable ? (
                        <DeleteButton
                          entity={item.resource_type}
                          id={item.id}
                          name={item.title}
                          tip={DELETE_TIP[item.resource_type]}
                          onDelete={() => api.delete(`/${DELETE_PATH[item.resource_type]}/${item.id}`)}
                          onDeleted={() => setItems(prev => prev.filter(i => itemKey(i) !== key))}
                          onError={setError}
                        />
                      ) : (
                        <IconButton
                          icon="delete"
                          disabled
                          tip={item.resource_type === 'quiz'
                            ? 'Удалить может только автор или администратор'
                            : 'Удалить может только администратор'}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default KnowledgeBasePage;
