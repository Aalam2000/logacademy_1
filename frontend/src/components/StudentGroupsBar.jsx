// Узкая строка плашек «название группы + три значка: видеоконференция,
// Telegram, WhatsApp» вверху кабинета студента. Студент может быть в
// нескольких группах — плашки идут в строку и переносятся, только если не
// хватает ширины. groups — [{id, name, video_url, telegram_chat_id, whatsapp}]
// (GET /groups/student/my или группа урока).
import React from 'react';
import { GroupContactIcons } from './ContactIcons';

function StudentGroupsBar({ groups }) {
  if (!groups || groups.length === 0) return null;
  return (
    <div className="group-bar">
      {groups.map(g => (
        <div key={g.id} className="group-bar__card">
          <span className="group-bar__name">{g.name}</span>
          <GroupContactIcons video={g.video_url} telegram={g.telegram_chat_id} whatsapp={g.whatsapp} />
        </div>
      ))}
    </div>
  );
}

export default StudentGroupsBar;
