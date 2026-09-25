import React, { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MINUTE_STEPS = [0, 10, 20, 30, 40, 50];

const pad = (n) => String(n).padStart(2, '0');

function formatDisplay(date) {
  if (!date) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();
}

// 6x7 сетка дней месяца, неделя начинается с понедельника.
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Пн
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return cells;
}

// Ближайшая допустимая «десятиминутка» не больше фактических минут.
function roundMinutesDown(minutes) {
  return MINUTE_STEPS.reduce((best, m) => (m <= minutes ? m : best), 0);
}

/**
 * Клик-поле с датой/временем: открывает попап-календарь (дни месяца +
 * часы/минуты с шагом 10). Сохранение — на вызывающей стороне, через
 * onCommit, срабатывающий при закрытии попапа (клик мимо).
 *
 * value: Date | null
 * onChange(date: Date): вызывается на каждое изменение (день/час/минута)
 * onCommit(): вызывается при закрытии попапа (клик вне поля)
 */
// hourOnly — выбор только часа (минуты всегда :00), напр. дедлайн ДЗ;
// placeholder — текст кнопки, пока значение не выбрано;
// floating — попап position:fixed (внутри таблицы со скроллом, чтобы не обрезался).
function DateTimePicker({ value, onChange, onCommit, disabled, hourOnly, placeholder, floating }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) setViewDate(value);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        if (onCommit) onCommit();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line
  }, [open]);

  const closeAndCommit = () => {
    setOpen(false);
    if (onCommit) onCommit();
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    if (open) {
      closeAndCommit();
      return;
    }
    if (!value) {
      // Новый урок / пустое значение — по умолчанию минуты всегда 00.
      const now = new Date();
      now.setMinutes(0, 0, 0);
      setViewDate(now);
      onChange(now);
    }
    setOpen(true);
  };

  const selectDay = (day) => {
    const base = value || viewDate;
    const next = new Date(day);
    next.setHours(base.getHours(), hourOnly ? 0 : base.getMinutes(), 0, 0);
    onChange(next);
  };

  const changeHour = (h) => {
    const base = value || viewDate;
    const next = new Date(base);
    next.setHours(Number(h));
    if (hourOnly) next.setMinutes(0, 0, 0);
    onChange(next);
  };

  const changeMinute = (m) => {
    const base = value || viewDate;
    const next = new Date(base);
    next.setMinutes(Number(m));
    onChange(next);
  };

  const navMonth = (delta) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const gridYear = viewDate.getFullYear();
  const gridMonth = viewDate.getMonth();
  const cells = buildMonthGrid(gridYear, gridMonth);
  const today = new Date();

  return (
    <div className="datetime-picker" ref={containerRef}>
      <button
        type="button"
        className="datetime-picker__trigger"
        onClick={handleTriggerClick}
        disabled={disabled}
      >
        <span>{formatDisplay(value) || placeholder || 'Выбрать дату и время'}</span>
        <span className="datetime-picker__icon">📅</span>
      </button>

      {open && (
        <div className="datetime-picker__popover" style={floating ? floatingStyle(containerRef.current) : undefined}>
          <div className="datetime-picker__calendar-header">
            <button type="button" className="datetime-picker__nav" onClick={() => navMonth(-1)}>{'‹'}</button>
            <span>{MONTHS[gridMonth]} {gridYear}</span>
            <button type="button" className="datetime-picker__nav" onClick={() => navMonth(1)}>{'›'}</button>
          </div>

          <div className="datetime-picker__weekdays">
            {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
          </div>

          <div className="datetime-picker__grid">
            {cells.map((day) => {
              const inMonth = day.getMonth() === gridMonth;
              const classes = ['datetime-picker__day'];
              if (!inMonth) classes.push('datetime-picker__day--muted');
              if (sameDay(day, value)) classes.push('datetime-picker__day--selected');
              if (sameDay(day, today)) classes.push('datetime-picker__day--today');
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  className={classes.join(' ')}
                  onClick={() => selectDay(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="datetime-picker__time">
            <select
              className="input"
              value={value ? value.getHours() : 0}
              onChange={e => changeHour(e.target.value)}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{pad(h)}</option>
              ))}
            </select>
            <span>{':'}</span>
            {hourOnly ? <span>{'00'}</span> : (
              <select
                className="input"
                value={value ? roundMinutesDown(value.getMinutes()) : 0}
                onChange={e => changeMinute(e.target.value)}
              >
                {MINUTE_STEPS.map(m => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Попап под полем, но в координатах окна; не вылезает за нижний край.
function floatingStyle(el) {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  const top = Math.min(r.bottom + 8, window.innerHeight - 340);
  return { position: 'fixed', top: Math.max(8, top), left: Math.min(r.left, window.innerWidth - 270), zIndex: 1000 };
}

export default DateTimePicker;
