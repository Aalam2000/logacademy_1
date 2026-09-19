// TypeBadgeIcons.js — маленькие SVG-иконки для бейджей типов в «Базе знаний».
// Размер задаётся CSS-классом .type-badge__icon в components.css (12x12).
// stroke="currentColor" — наследует белый цвет бейджа.

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
};

export function IconBadgeFile(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 3 H19 V21 H5 Z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

export function IconBadgeQuiz(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="4" width="16" height="16" />
      <line x1="9" y1="12" x2="12" y2="12" />
      <line x1="12" y1="9" x2="12" y2="15" />
    </svg>
  );
}

export function IconBadgeLink(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 14 L14 10" />
      <path d="M8 12 L6 14 C4 16 4 19 6 21 C8 23 11 23 13 21 L15 19" />
      <path d="M16 12 L18 10 C20 8 20 5 18 3 C16 1 13 1 11 3 L9 5" />
    </svg>
  );
}