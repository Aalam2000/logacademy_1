// Кнопка-значок в стиле «HUD-контур»: белый квадрат с чернильной рамкой,
// при наведении заливается (обычная — чёрным, warn — янтарным, danger —
// красным). Подпись — только в мгновенной подсказке (data-tip, см. Tooltip.jsx).
//
// <IconButton icon="archive" tip="Отправить в архив" variant="warn" onClick={...} />
import React from 'react';

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  className: 'icon-btn__svg',
};

const ICONS = {
  // Расписание — календарь с ячейками
  schedule: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="16" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <rect x="7" y="13" width="3" height="3" />
      <rect x="14" y="13" width="3" height="3" />
    </svg>
  ),
  // Открыть уроки — раскрытый замок
  unlock: (
    <svg {...svgProps}>
      <rect x="4" y="11" width="16" height="10" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      <line x1="12" y1="15" x2="12" y2="17" />
    </svg>
  ),
  // Обновить материалы — папка со стрелкой внутрь
  materials: (
    <svg {...svgProps}>
      <path d="M3 5h6l2 3h10v12H3z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <polyline points="9.5,14.5 12,17 14.5,14.5" />
    </svg>
  ),
  // В архив — ящик
  archive: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="5" />
      <path d="M5 9v11h14V9" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  ),
  // Вернуть из архива — ящик со стрелкой вверх
  restore: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="5" />
      <path d="M5 9v11h14V9" />
      <polyline points="9.5,16 12,13.5 14.5,16" />
      <line x1="12" y1="13.5" x2="12" y2="18" />
    </svg>
  ),
  // Сменить пароль — ключ
  key: (
    <svg {...svgProps}>
      <circle cx="8" cy="15" r="4" />
      <line x1="11" y1="12" x2="20" y2="3" />
      <line x1="17" y1="6" x2="20" y2="9" />
      <line x1="14" y1="9" x2="16" y2="11" />
    </svg>
  ),
  // Удалить навсегда — корзина
  delete: (
    <svg {...svgProps}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <path d="M9 6V3h6v3" />
      <path d="M6 6l1 15h10l1-15" />
      <line x1="10" y1="10" x2="10" y2="17" />
      <line x1="14" y1="10" x2="14" y2="17" />
    </svg>
  ),
};

function IconButton({ icon, tip, variant, active, disabled, onClick, type = 'button' }) {
  const classes = ['icon-btn'];
  if (variant) classes.push(`icon-btn--${variant}`);
  if (active) classes.push('icon-btn--active');
  return (
    <button
      type={type}
      className={classes.join(' ')}
      data-tip={tip}
      aria-label={tip}
      aria-pressed={active === undefined ? undefined : !!active}
      disabled={disabled}
      onClick={onClick}
    >
      {ICONS[icon]}
    </button>
  );
}

export default IconButton;
