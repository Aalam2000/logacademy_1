import React from 'react';

// Поле хранит либо юзернейм публичной группы (@name), либо ссылку-приглашение
// приватной группы (t.me/+xxxxx или t.me/joinchat/xxxxx, либо целиком с https://) —
// у приватной группы в Telegram нет @юзернейма, только invite-ссылка.
export function telegramHref(value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^t\.me\//i.test(v)) return `https://${v}`;
  return `https://t.me/${v.replace(/^@/, '')}`;
}

// whatsapp хранит номер телефона — wa.me принимает только цифры.
export function whatsappHref(value) {
  const digits = (value || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export function ContactIcon({ type, value }) {
  const href = type === 'telegram' ? telegramHref(value) : whatsappHref(value);
  const label = type === 'telegram' ? 'Telegram' : 'WhatsApp';
  const svg = type === 'telegram' ? (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M21.5 3.5 2.7 10.9c-.9.36-.9 1.63.02 1.96l4.53 1.62 1.73 5.6c.24.76 1.22.96 1.74.35l2.55-2.98 4.6 3.5c.7.53 1.7.14 1.87-.73l3.29-15.9c.18-.87-.7-1.55-1.53-1.22Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm4.9 14.1c-.5.6-1.6 1.2-1.8 1.2-.5.1-.9.3-3.1-.6-2.6-1-4.3-3.7-4.4-3.8-.1-.2-1-1.4-1-2.6 0-1.2.7-1.8.9-2.1.2-.3.5-.3.7-.3.2 0 .4 0 .6.5.3.5.8 1.9.9 2 .1.1.1.3 0 .4-.1.1-.1.3-.2.4l-.4.5c-.1.1-.3.3-.1.6.1.3.7 1.2 1.5 1.9 1 .9 1.9 1.3 2.2 1.4.3.2.5.1.6 0 .1-.1.6-.7.8-1 .2-.2.3-.2.6-.1.3.1 1.6.8 1.9.9.3.2.5.3.6.4 0 .1 0 .6-.2 1.2Z" />
    </svg>
  );
  if (!href) {
    return (
      <span className={`row-icon row-icon--${type === 'telegram' ? 'tg' : 'wa'} row-icon--disabled`} data-tip={`${label} не указан`}>
        {svg}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`row-icon row-icon--${type === 'telegram' ? 'tg' : 'wa'}`}
      data-tip={label}
      onClick={e => e.stopPropagation()}
    >
      {svg}
    </a>
  );
}

// Готовая пара иконок Telegram/WhatsApp для строки таблицы студента —
// value передаются как есть, ContactIcon сам решает кликабельно или нет.
export function StudentContactIcons({ telegram, whatsapp }) {
  return (
    <div className="table__icons">
      <ContactIcon type="telegram" value={telegram} />
      <ContactIcon type="whatsapp" value={whatsapp} />
    </div>
  );
}
