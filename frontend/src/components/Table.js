// Таблица: общие стили th/td вместо копий по 7 страницам. Специально БЕЗ
// data-driven API (никаких columns={[...]} с текстом внутри пропа) — чтобы
// заголовки/ячейки оставались обычными JSX-литералами прямо на странице,
// как сейчас, и autoi18n продолжал находить их без доработок.
import React from 'react';

function Table({ children, className = '' }) {
  return <table className={`table${className ? ' ' + className : ''}`}>{children}</table>;
}

function Th({ children, className = '' }) {
  return <th className={className || undefined}>{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={className || undefined}>{children}</td>;
}

Table.Th = Th;
Table.Td = Td;

export default Table;
