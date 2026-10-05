// Общие части отчётов за месяц — по педагогу (TeacherReportPage.jsx) и по
// ученику (StudentReportPage.jsx): панель «Назад / месяц / Печать», месяц в
// шапке для бумаги, цветная оценка показателя.
import React from 'react';
import MonthPicker from './MonthPicker';
import { MONTH_NAMES } from '../utils/months';

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('ru-RU') : '—');
export const withSign = (n) => (n > 0 ? `+${n}` : `${n}`);

// Панель над отчётом. На бумагу не идёт (.toolbar скрыт при печати).
export function ReportToolbar({ onBack, month, onMonth, canPrint }) {
  return (
    <div className="toolbar toolbar--inline">
      <button className="btn btn--outline" onClick={onBack}>{'Назад'}</button>
      <MonthPicker value={month} max={currentMonth()} onChange={onMonth} tip="Месяц отчёта" />
      <button className="btn btn--outline" onClick={() => window.print()} disabled={!canPrint}>{'Печать'}</button>
    </div>
  );
}

// Месяц в шапке отчёта: на экране он виден в панели, на бумаге панели нет
export function ReportPeriod({ month }) {
  return (
    <div className="print-only report__period">{MONTH_NAMES[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</div>
  );
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
