// Общие части отчётов — по педагогу (TeacherReportPage.jsx) и по ученику
// (StudentReportPage.jsx): панель «Назад / Печать», выбор периода, период в
// шапке отчёта, цветная оценка показателя.
// Периоды (backend/app/report_common.py): month — месяц с листанием,
// year — с начала учебного года, all — с начала обучения / преподавания,
// custom — произвольный, две даты.
import React from 'react';
import MonthPicker from './MonthPicker';
import { MONTH_NAMES } from '../utils/months';

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const currentMonth = () => isoDay(new Date()).slice(0, 7);

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('ru-RU') : '—');
// 'ГГГГ-ММ-ДД' → 'ДД.ММ.ГГГГ' — без Date, чтобы день не съезжал из-за часового пояса
const formatDay = (iso) => (iso ? iso.split('-').reverse().join('.') : '—');
export const withSign = (n) => (n > 0 ? `+${n}` : `${n}`);

// Период отчёта по умолчанию — текущий месяц; даты произвольного периода
// заранее стоят «с начала месяца по сегодня».
export const defaultPeriod = () => {
  const today = new Date();
  return { kind: 'month', month: currentMonth(), from: `${currentMonth()}-01`, to: isoDay(today) };
};

// Параметры запроса отчёта для выбранного периода
export const periodParams = (period) => {
  if (period.kind === 'month') return { period: 'month', month: period.month };
  if (period.kind === 'custom') return { period: 'custom', date_from: period.from, date_to: period.to };
  return { period: period.kind };
};

// Панель над отчётом и выбор периода. На бумагу не идут.
// allLabel — подпись периода «с первого урока»: у ученика и у педагога она своя.
export function ReportToolbar({ onBack, period, onPeriod, allLabel, canPrint }) {
  const kinds = [
    { key: 'month', label: 'Месяц' },
    { key: 'year', label: 'С начала года', tip: 'С начала учебного года — с 1 сентября по сегодня' },
    { key: 'all', label: allLabel, tip: 'С первого урока по сегодня' },
    { key: 'custom', label: 'Период', tip: 'Произвольный период — с даты по дату' },
  ];
  const set = (patch) => onPeriod({ ...period, ...patch });
  return (
    <>
      <div className="toolbar toolbar--inline">
        <button className="btn btn--outline" onClick={onBack}>{'Назад'}</button>
        <button className="btn btn--outline" onClick={() => window.print()} disabled={!canPrint}>{'Печать'}</button>
      </div>
      <div className="toolbar__filters report-periods no-print">
        {kinds.map(k => (
          <button
            key={k.key}
            type="button"
            className={`tab tab--underline${period.kind === k.key ? ' tab--active' : ''}`}
            data-tip={k.tip}
            onClick={() => set({ kind: k.key })}
          >
            {k.label}
          </button>
        ))}
        {period.kind === 'month' && (
          <MonthPicker value={period.month} max={currentMonth()} onChange={month => set({ month })} tip="Месяц отчёта" />
        )}
        {period.kind === 'custom' && (
          <>
            <input type="date" className="input" value={period.from} max={period.to}
              onChange={e => e.target.value && set({ from: e.target.value })} />
            <span>{'—'}</span>
            <input type="date" className="input" value={period.to} min={period.from} max={isoDay(new Date())}
              onChange={e => e.target.value && set({ to: e.target.value })} />
          </>
        )}
      </div>
    </>
  );
}

// Период в шапке отчёта. Месяц на экране виден в панели — его название идёт
// только на бумагу; у остальных периодов даты нужны и на экране: «с начала
// обучения» — это с какого числа. period — из ответа отчёта: {kind, month, from, to}.
export function ReportPeriod({ period }) {
  if (period.kind === 'month') {
    return (
      <div className="print-only report__period">
        {MONTH_NAMES[Number(period.month.slice(5)) - 1]} {period.month.slice(0, 4)}
      </div>
    );
  }
  return <div className="report__period">{formatDay(period.from)} — {formatDay(period.to)}</div>;
}

// Оценка показателя: цветная точка и подпись
export function Status({ status }) {
  return (
    <>
      <span className={`report__dot report__dot--${status}`} />
      {status === 'good' ? 'в норме' : status === 'warn' ? 'внимание' : status === 'bad' ? 'ниже нормы' : 'нет данных'}
    </>
  );
}
