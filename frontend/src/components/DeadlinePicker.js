// Компактный выбор дедлайна: дата + час, минуты всегда :00. Необязателен.
// value: Date | null; onChange(Date | null)
import React from 'react';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function DeadlinePicker({ value, onChange, disabled }) {
  const setDate = (str) => {
    if (!str) { onChange(null); return; }
    const [y, m, d] = str.split('-').map(Number);
    const hour = value ? value.getHours() : 23;
    onChange(new Date(y, m - 1, d, hour, 0, 0, 0));
  };
  const setHour = (h) => {
    if (!value) return;
    const next = new Date(value);
    next.setHours(Number(h), 0, 0, 0);
    onChange(next);
  };
  return (
    <div className="deadline-picker">
      <input
        type="date"
        className="input"
        value={value ? toDateInput(value) : ''}
        onChange={e => setDate(e.target.value)}
        disabled={disabled}
      />
      <select
        className="input"
        value={value ? value.getHours() : ''}
        onChange={e => setHour(e.target.value)}
        disabled={disabled || !value}
      >
        {!value && <option value="">{'--:00'}</option>}
        {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${pad(h)}:00`}</option>)}
      </select>
      {value && (
        <button type="button" className="btn btn--sm" data-tip="Без срока" onClick={() => onChange(null)} disabled={disabled}>✕</button>
      )}
    </div>
  );
}

export function formatDeadline(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:00`;
}

export default DeadlinePicker;
