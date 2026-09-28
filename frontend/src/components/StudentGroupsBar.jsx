// Узкая строка плашек «название группы + вход в видеоконференцию» вверху
// кабинета студента. Студент может быть в нескольких группах — плашки
// идут в строку и переносятся, только если не хватает ширины.
// groups — [{id, name, video_url}] (GET /groups/student/my или группа урока).
import React from 'react';
import VideoCallButton from './VideoCallButton';

function StudentGroupsBar({ groups }) {
  if (!groups || groups.length === 0) return null;
  return (
    <div className="group-bar">
      {groups.map(g => (
        <div key={g.id} className="group-bar__card">
          <span className="group-bar__name">{g.name}</span>
          <VideoCallButton url={g.video_url} compact />
        </div>
      ))}
    </div>
  );
}

export default StudentGroupsBar;
