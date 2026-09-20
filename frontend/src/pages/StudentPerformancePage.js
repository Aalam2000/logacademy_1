import React, { useState, useEffect } from 'react';
import api from '../api/auth';

// Метка "по факту" для пропуска — та же логика, что status_label на
// бэкенде (routers/lessons.py, _build_status_label), но тут нужны только
// два случая: сам пропуск (absent) и уважительная причина (excused).
// Остальные статусы (был/онлайн/ничего не отмечено) в "Пропуски" не входят.
const ABSENCE_LABELS = {
  absent: 'Пропуск',
  excused: 'По уважительной причине',
};

function StudentPerformancePage() {
  const [marks, setMarks] = useState([]);
  const [tab, setTab] = useState('grades'); // grades | absences

  useEffect(() => {
    api.get('/lessons/student/marks').then(r => setMarks(r.data));
  }, []);

  const absenceRows = marks.filter(m => ABSENCE_LABELS[m.attendance_status]);

  return (
    <div className="page">
      <h2>{'Успеваемость'}</h2>
      <div className="toolbar__filters">
        <button
          type="button"
          className={`tab tab--underline${tab === 'grades' ? ' tab--active' : ''}`}
          onClick={() => setTab('grades')}
        >
          {'Оценки'}
        </button>
        <button
          type="button"
          className={`tab tab--underline${tab === 'absences' ? ' tab--active' : ''}`}
          onClick={() => setTab('absences')}
        >
          {'Пропуски'}
        </button>
      </div>

      {tab === 'grades' ? (
        <table className="table">
          <thead>
            <tr>
              <th>{'Урок'}</th>
              <th>{'Оценка'}</th>
              <th>{'Экзамен'}</th>
              <th>{'Камент'}</th>
            </tr>
          </thead>
          <tbody>
            {marks.length === 0 && (
              <tr><td colSpan={4} className="table__empty">{'Оценок нет'}</td></tr>
            )}
            {marks.map(m => (
              <tr key={m.lesson_id}>
                <td>{m.lesson_title}</td>
                <td>{m.score ?? '—'}</td>
                <td>{m.exam_score ?? '—'}</td>
                <td>{m.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{'Дата'}</th>
              <th>{'Статус'}</th>
            </tr>
          </thead>
          <tbody>
            {absenceRows.length === 0 && (
              <tr><td colSpan={2} className="table__empty">{'Пропусков нет'}</td></tr>
            )}
            {absenceRows.map(m => (
              <tr key={m.lesson_id}>
                <td>{m.date ? new Date(m.date).toLocaleDateString('ru-RU') : '—'}</td>
                <td>{ABSENCE_LABELS[m.attendance_status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default StudentPerformancePage;
