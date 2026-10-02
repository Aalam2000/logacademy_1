// Название академии — настройка админа (вкладка «Академия»), а не текст в
// коде. Нужно в заголовке вкладки браузера и в подписях к логотипу, в том
// числе на странице входа, поэтому берётся без авторизации и один раз на
// загрузку страницы.
import { useEffect, useState } from 'react';
import { getAcademyPublic } from '../api/academy';

const FALLBACK = 'Log Academy';
let cached = null;
let pending = null;
const listeners = new Set();

function apply(name) {
  cached = name || FALLBACK;
  document.title = cached;
  listeners.forEach(fn => fn(cached));
}

// Вызывается после сохранения на вкладке «Академия» — без перезагрузки страницы
export function setAcademyName(name) {
  apply(name);
}

export function useAcademyName() {
  const [name, setName] = useState(cached || FALLBACK);
  useEffect(() => {
    listeners.add(setName);
    if (cached) {
      setName(cached);
    } else {
      if (!pending) {
        pending = getAcademyPublic().then(d => apply(d.name)).catch(() => { pending = null; });
      }
    }
    return () => { listeners.delete(setName); };
  }, []);
  return name;
}
