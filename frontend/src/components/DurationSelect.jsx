// Выбор длительности урока — один для всех форм (генерация расписания,
// «+ Урок», страница урока, настройки группы). value/onChange — минуты (число).
import React from 'react';
import { DURATION_OPTIONS, formatDuration } from '../utils/lessonTime';

function DurationSelect({ value, onChange, className = 'input', disabled, title }) {
  const options = DURATION_OPTIONS.includes(value) || !value
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, value].sort((a, b) => a - b);
  return (
    <select
      className={className}
      value={value || ''}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      disabled={disabled}
      title={title}
    >
      {options.map(min => (
        <option key={min} value={min}>{formatDuration(min)}</option>
      ))}
    </select>
  );
}

export default DurationSelect;
