// Длительность урока (claude/calendar-duration-plan.md). В БД — минуты
// (lessons.duration_min, groups.lesson_duration_min), конец урока не
// хранится: end = date + duration_min.

export const DEFAULT_DURATION_MIN = 120;

// Варианты в выпадающих списках (DurationSelect). Нестандартное значение
// из БД не теряется — DurationSelect добавит его в список.
export const DURATION_OPTIONS = [60, 90, 120, 180, 240];

export function lessonEnd(lesson) {
  if (!lesson?.date) return null;
  const start = new Date(lesson.date);
  const minutes = lesson.duration_min || DEFAULT_DURATION_MIN;
  return new Date(start.getTime() + minutes * 60 * 1000);
}

// 60 → «1 ч», 90 → «1 ч 30 мин», 45 → «45 мин»
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
