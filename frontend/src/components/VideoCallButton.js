// Кнопка входа в видеоконференцию группы (claude/video-conference-plan.md).
// Ссылка постоянная (Google Meet и т.п.), хранится в groups.video_url.
// Нет ссылки — ничего не рендерим. Открываем в новой вкладке, чтобы
// платформа (урок, материалы) оставалась открытой рядом.
import React from 'react';

export function IconVideo(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m16 10 6-3v10l-6-3z" />
    </svg>
  );
}

// compact — только иконка (плашки студента), иначе иконка + подпись.
function VideoCallButton({ url, compact = false, label = 'Видеоконференция' }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={compact ? 'video-call video-call--compact' : 'btn btn--compact video-call'}
      title={'Войти в видеоконференцию'}
      aria-label={'Войти в видеоконференцию'}
      onClick={e => e.stopPropagation()}
    >
      <IconVideo />
      {!compact && <span>{label}</span>}
    </a>
  );
}

export default VideoCallButton;
