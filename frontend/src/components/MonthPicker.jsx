// Выбор месяца: «‹ Сентябрь 2026 ›». Значение — строка 'ГГГГ-ММ'.
// Родной <input type="month"> рисует сам браузер на своём языке, перевести
// его нельзя — поэтому свой переключатель с названиями месяцев из словаря.
import React from 'react';
import { MONTH_NAMES } from '../utils/months';

const shiftMonth = (value, delta) => {
  const [year, month] = value.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// max — последний доступный месяц ('ГГГГ-ММ'), позже него листать нельзя
function MonthPicker({ value, max, onChange, tip }) {
  const [year, month] = value.split('-').map(Number);
  return (
    <div className="month-picker" data-tip={tip}>
      <button type="button" className="btn btn--outline month-picker__arrow" aria-label="prev"
        onClick={() => onChange(shiftMonth(value, -1))}>‹</button>
      <span className="month-picker__label">{MONTH_NAMES[month - 1]} {year}</span>
      <button type="button" className="btn btn--outline month-picker__arrow" aria-label="next"
        disabled={!!max && value >= max} onClick={() => onChange(shiftMonth(value, 1))}>›</button>
    </div>
  );
}

export default MonthPicker;
