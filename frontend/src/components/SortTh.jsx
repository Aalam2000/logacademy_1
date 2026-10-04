// Шапка сортируемого столбца: клик — сортировка по столбцу (повторный клик
// меняет направление), наведение — название чуть крупнее. Стили — .table__th--sort.
//
// <SortTh k="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>{'Имя'}</SortTh>
import React from 'react';

function SortTh({ k, sortKey, sortDir, onSort, tip, center, children }) {
  const active = sortKey === k;
  const classes = ['table__th--sort'];
  if (active) classes.push('table__th--sorted');
  if (center) classes.push('table__cell--center');
  return (
    <th
      className={classes.join(' ')}
      data-tip={tip}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      tabIndex={0}
      onClick={() => onSort(k)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(k); } }}
    >
      <span className="table__th-label">
        {children}
        {active && <span className="table__th-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

// Сортировка строк таблицы. getValue(row, key) — значение ячейки; textKeys —
// текстовые столбцы (остальные — числа). Пустые значения — всегда внизу;
// при равенстве — по tieBreak (строка).
export function sortRows(rows, sortKey, sortDir, getValue, textKeys, tieBreak) {
  const isText = textKeys.includes(sortKey);
  const sign = sortDir === 'asc' ? 1 : -1;
  const tie = (a, b) => String(tieBreak(a) || '').localeCompare(String(tieBreak(b) || ''));
  return [...rows].sort((a, b) => {
    const va = getValue(a, sortKey);
    const vb = getValue(b, sortKey);
    const ea = va === null || va === undefined || va === '';
    const eb = vb === null || vb === undefined || vb === '';
    if (ea || eb) return ea && eb ? tie(a, b) : (ea ? 1 : -1);
    const cmp = isText ? String(va).localeCompare(String(vb)) : va - vb;
    return cmp !== 0 ? cmp * sign : tie(a, b);
  });
}

export default SortTh;
