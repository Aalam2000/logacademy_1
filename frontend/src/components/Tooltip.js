// Единая всплывающая подсказка платформы (стиль «Комикс»).
//
// Использование: любому элементу достаточно атрибута data-tip="Текст" —
// подсказка появляется МГНОВЕННО при наведении (и при фокусе с клавиатуры).
// Не используйте вместе с title — у title своя подсказка с задержкой.
//
// Рисуется одним слоем поверх всей страницы (портал в body, position:fixed),
// поэтому не обрезается таблицами с прокруткой и модалками; у края экрана
// сдвигается внутрь, если сверху нет места — показывается снизу.
// Подключается один раз в App.js (<TooltipLayer />).
//
// Неактивные (disabled) кнопки браузеры не всегда «видят» под мышью, поэтому
// им в CSS выключены pointer-events, а здесь они ищутся по координатам —
// подсказка на неактивной кнопке тоже работает.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LONG_TEXT = 40; // длиннее — облако переносит строки (адреса, пути, темы)
const GAP = 28;     // расстояние от элемента до облака (под «пузырьки»)
const MARGIN = 8;   // минимальный отступ облака от края окна

export function TooltipLayer() {
  const [tip, setTip] = useState(null); // { text, rect }
  const [pos, setPos] = useState(null); // { left, top, below, tailX }
  const boxRef = useRef(null);

  useEffect(() => {
    let current = null;
    const findTipElement = (e) => {
      const t = e.target;
      if (!t || !t.closest) return null;
      const el = t.closest('[data-tip]');
      if (el) return el;
      if (e.type !== 'mousemove' || !t.querySelectorAll) return null;
      for (const c of t.querySelectorAll('[data-tip]:disabled')) {
        const r = c.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return c;
      }
      return null;
    };
    const show = (e) => {
      const el = findTipElement(e);
      if (el === current) return;
      current = el;
      const text = el && el.getAttribute('data-tip');
      if (!text) { setTip(null); return; }
      setTip({ text, rect: el.getBoundingClientRect() });
    };
    const hide = () => { current = null; setTip(null); };
    const leaveWindow = (e) => { if (!e.relatedTarget) hide(); };

    document.addEventListener('mousemove', show);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('mouseout', leaveWindow);
    document.addEventListener('mousedown', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mousemove', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('mouseout', leaveWindow);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Меряем облако до отрисовки кадра — пользователь видит его сразу на месте
  useLayoutEffect(() => {
    if (!tip || !boxRef.current) { setPos(null); return; }
    const { width, height } = boxRef.current.getBoundingClientRect();
    const r = tip.rect;
    const centerX = r.left + r.width / 2;
    let below = false;
    let top = r.top - height - GAP;
    if (top < MARGIN) { below = true; top = r.bottom + GAP; }
    const left = Math.min(Math.max(centerX - width / 2, MARGIN), window.innerWidth - width - MARGIN);
    setPos({ left, top, below, tailX: centerX - left });
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={boxRef}
      className={`la-tip${pos && pos.below ? ' la-tip--below' : ''}${tip.text.length > LONG_TEXT ? ' la-tip--long' : ''}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
      role="tooltip"
    >
      <div className="la-tip__bubble">{tip.text}</div>
      <span className="la-tip__dot la-tip__dot--big" style={{ left: pos ? pos.tailX : 0 }} />
      <span className="la-tip__dot la-tip__dot--small" style={{ left: pos ? pos.tailX : 0 }} />
    </div>,
    document.body
  );
}

export default TooltipLayer;
