// Обёртка над react-big-calendar — общий календарь уроков (Месяц/Неделя/
// День, как в Google Calendar). Внешний вид переопределён в
// ../styles/calendar.css под токены Log Academy; сам компонент не решает,
// откуда взялись уроки — это забота вызывающей страницы (GroupPage —
// уроки одной группы, GroupsPage — все уроки препода сразу).
import React, { useMemo } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ru';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendar.css';

moment.locale('ru');
const localizer = momentLocalizer(moment);

const MESSAGES = {
  month: 'Месяц',
  week: 'Неделя',
  day: 'День',
  today: 'Сегодня',
  previous: 'Назад',
  next: 'Вперёд',
  noEventsInRange: 'Уроков нет',
  showMore: (count) => `ещё ${count}`,
};

// Раскраска событий по группе (нужна только на /groups, где в один день
// могут быть уроки разных групп) — фиксированная палитра, назначается по
// порядку появления group_id в списке уроков.
const GROUP_COLORS = ['#EC3013', '#2E5FA3', '#3B6D11', '#C026D3', '#0891B2', '#f59e0b', '#605D5D', '#059669'];

// lessons: [{id, group_id, group_name?, title, date}]
function Calendar({ lessons, onSelectLesson, colorByGroup = false, defaultView = 'month' }) {
  const groupColorMap = useMemo(() => {
    const map = {};
    if (!colorByGroup) return map;
    let i = 0;
    for (const l of lessons) {
      if (!(l.group_id in map)) {
        map[l.group_id] = GROUP_COLORS[i % GROUP_COLORS.length];
        i += 1;
      }
    }
    return map;
  }, [lessons, colorByGroup]);

  const events = useMemo(() => lessons
    .filter(l => l.date)
    .map(l => {
      const start = new Date(l.date);
      return {
        id: l.id,
        title: colorByGroup && l.group_name ? `${l.group_name}: ${l.title}` : l.title,
        start,
        end: start,
        resource: l,
      };
    }), [lessons, colorByGroup]);

  const legendGroups = useMemo(() => {
    if (!colorByGroup) return [];
    const seen = new Set();
    const result = [];
    for (const l of lessons) {
      if (!seen.has(l.group_id)) {
        seen.add(l.group_id);
        result.push(l);
      }
    }
    return result;
  }, [lessons, colorByGroup]);

  return (
    <div className="la-calendar">
      <BigCalendar
        localizer={localizer}
        events={events}
        views={['month', 'week', 'day']}
        defaultView={defaultView}
        messages={MESSAGES}
        culture="ru"
        popup
        eventPropGetter={(event) => ({
          className: 'la-calendar__event',
          style: { '--la-event-color': colorByGroup ? (groupColorMap[event.resource.group_id] || GROUP_COLORS[0]) : 'var(--color-primary)' },
        })}
        onSelectEvent={(event) => onSelectLesson && onSelectLesson(event.resource)}
      />
      {legendGroups.length > 0 && (
        <div className="la-calendar__legend">
          {legendGroups.map(l => (
            <span key={l.group_id} className="la-calendar__legend-item">
              <span className="la-calendar__legend-dot" style={{ '--la-event-color': groupColorMap[l.group_id] }} />
              {l.group_name || `#${l.group_id}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Calendar;
