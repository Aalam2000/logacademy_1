// Сигнал между вкладками одного браузера: живой квиз-«Экзамен» шлёт сюда
// сообщение в момент, когда оценка записана в lesson_marks, а открытая
// страница урока (если это тот же урок) сама перезапрашивает табличку —
// без постоянного опроса сервера. Работает только между вкладками одного
// источника (BroadcastChannel), что и нужно: обе вкладки у одного препода
// в одном браузере.
const CHANNEL_NAME = 'lesson-marks-updated';

export function notifyLessonMarksUpdated(lessonId) {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ lessonId });
    ch.close();
  } catch {
    // BroadcastChannel недоступен (старый браузер) — просто не сигналим,
    // страница урока подтянет данные при обычной перезагрузке.
  }
}

export function subscribeLessonMarksUpdated(onUpdate) {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (event) => onUpdate(event.data?.lessonId);
    return () => ch.close();
  } catch {
    return () => {};
  }
}
