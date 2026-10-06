// «Из урока» — подтянуть в урок материалы другого урока группы (файлы,
// ссылки, квизы). Нужно для дополнительного урока: в списке подсвечены
// уроки, которые его ученики пропустили.
//   <LessonSourcesModal lessonId onCopied={(result, source) => …} onClose />
import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { copyLessonItems, getLessonSources } from '../api/lessons';
import { extractErrorMessage } from '../utils/errors';

function LessonSourcesModal({ lessonId, onCopied, onClose }) {
  const [sources, setSources] = useState(null); // null — загрузка
  const [error, setError] = useState('');
  const [copyingId, setCopyingId] = useState(null);

  useEffect(() => {
    let alive = true;
    getLessonSources(lessonId)
      .then(data => { if (alive) setSources(data); })
      .catch(err => { if (alive) { setSources([]); setError(extractErrorMessage(err, 'Не удалось загрузить уроки')); } });
    return () => { alive = false; };
  }, [lessonId]);

  const copy = async (source) => {
    setCopyingId(source.id);
    setError('');
    try {
      onCopied(await copyLessonItems(lessonId, source.id), source);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось подтянуть материалы'));
      setCopyingId(null);
    }
  };

  return (
    <Modal title={'Материалы из другого урока'} onClose={onClose} size="xwide">
      <p className="hint-text">{'Все материалы выбранного урока — файлы, ссылки и квизы — добавятся в этот урок.'}</p>
      {error && <div className="error-text error-text--muted">{error}</div>}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{'Дата'}</th>
              <th>{'Урок'}</th>
              <th>{'Материалов'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sources === null ? (
              <tr><td colSpan={4} className="table__empty">{'Загрузка...'}</td></tr>
            ) : sources.length === 0 ? (
              <tr><td colSpan={4} className="table__empty">{'Прошедших уроков пока нет'}</td></tr>
            ) : (
              sources.map(s => (
                <tr key={s.id} className={s.missed_by.length > 0 ? 'table__row--homework-pending table__row--attention' : ''}>
                  <td className="nowrap">{new Date(s.date).toLocaleDateString('ru-RU')}</td>
                  <td>
                    {s.title}
                    {s.missed_by.length > 0 && (
                      <span className="badge badge--homework-pending badge--inline">
                        {'Пропустил'}: {s.missed_by.join(', ')}
                      </span>
                    )}
                  </td>
                  <td>{s.items_count}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => copy(s)}
                      disabled={s.items_count === 0 || copyingId !== null}
                    >
                      {copyingId === s.id ? '...' : 'Подтянуть'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default LessonSourcesModal;
