// Свежесть отметок «есть непроверенное ДЗ» (шапка, «Мои группы», группа, журнал
// урока): пока вкладка видна, раз в 15 секунд тихо перечитываем данные; сразу —
// при возврате на вкладку и после проверки ДЗ педагогом (notifyHomeworkChanged
// вызывает api/homework.js).
import { useEffect, useRef } from 'react';

const REFRESH_MS = 15 * 1000;
const EVENT = 'la:homework-changed';

export function notifyHomeworkChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function useHomeworkRefresh(refresh, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = setInterval(run, REFRESH_MS);
    document.addEventListener('visibilitychange', run);
    window.addEventListener(EVENT, run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener(EVENT, run);
    };
  }, [enabled]);
}
