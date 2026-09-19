// CyberIcons.js — кибер-панк SVG-иконки для сайдбара (Navigation).
// Монохром: stroke="currentColor", поэтому цвет наследуется от текста
// ссылки — чёрный в обычном состоянии, красный у активного пункта.
// Все иконки: viewBox 24x24, strokeWidth 1.8, острые углы (linecap/linejoin
// square/miter) — стиль Log Academy.
//
// Размер задаётся через CSS-класс .nav__icon в components.css, а не через
// атрибуты width/height — чтобы можно было менять централизованно.

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
};

// 1. Главная — сетка с диагоналями (HUD-grid)
export function IconDashboard(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <line x1="10" y1="10" x2="14" y2="14" />
      <line x1="14" y1="10" x2="10" y2="14" />
    </svg>
  );
}

// 2. База знаний — серверный стек
export function IconKnowledge(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="4" width="16" height="6" />
      <rect x="4" y="14" width="16" height="6" />
      <line x1="7" y1="7" x2="9" y2="7" />
      <line x1="7" y1="17" x2="9" y2="17" />
    </svg>
  );
}

// 3. Студенты — группа в шестиугольнике
export function IconStudents(props) {
  return (
    <svg {...baseProps} {...props}>
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
      <circle cx="9" cy="11" r="1.3" />
      <circle cx="15" cy="11" r="1.3" />
      <path d="M6.5 16 C6.5 14 7.5 13 9 13 C10.5 13 11.5 14 11.5 16" />
      <path d="M12.5 16 C12.5 14 13.5 13 15 13 C16.5 13 17.5 14 17.5 16" />
    </svg>
  );
}

// 4. Преподы — указка + силуэт в рамке
export function IconTeachers(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="4" width="16" height="16" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M6 15 C6 12 7.5 11 9 11 C10.5 11 12 12 12 15" />
      <line x1="13" y1="13" x2="19" y2="13" />
    </svg>
  );
}

// 5. Профиль — ID-карта с чипом
export function IconProfile(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="5" width="18" height="14" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16 C6 14 7.5 13 9 13 C10.5 13 12 14 12 16" />
      <line x1="14" y1="9" x2="19" y2="9" />
      <line x1="14" y1="12" x2="19" y2="12" />
      <line x1="14" y1="15" x2="17" y2="15" />
    </svg>
  );
}

// 6. Админ — терминал с курсором
export function IconAdmin(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="16" />
      <polyline points="7,9 10,12 7,15" />
      <line x1="12" y1="15" x2="17" y2="15" />
    </svg>
  );
}