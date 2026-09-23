// Обёртка над react-big-calendar — общий календарь уроков (Месяц/Неделя/
// День, как в Google Calendar). Внешний вид переопределён в
// ../styles/calendar.css под токены Log Academy.
//
// Компонент ничего не знает про «группы» — только рисует события. Кто
// вызывает (GroupPage — уроки одной группы, GroupsPage — все уроки
// препода сразу) сам решает, откуда взялись уроки и как их красить
// (getEventColor), и сам показывает список групп для выбора рядом —
// это не забота календаря.
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

// Общая палитра для раскраски «по группе» — используется здесь через
// getEventColor и отдельно на GroupsPage.js для списка групп рядом с
// календарём, чтобы цвета совпадали.
export const GROUP_COLORS = ['#EC3013', '#2E5FA3', '#3B6D11', '#C026D3', '#0891B2', '#f59e0b', '#605D5D', '#059669'];

// lessons: [{id, group_id, group_name?, title, date}]
// getEventColor(lesson) => css-цвет; не задан — все события фирменным красным.
function Calendar({ lessons, onSelectLesson, getEventColor, defaultView = 'month' }) {
  const events = useMemo(() => lessons
    .filter(l => l.date)
    .map(l => {
      const start = new Date(l.date);
      return {
        id: l.id,
        title: l.group_name ? `${l.group_name}: ${l.title}` : l.title,
        start,
        end: start,
        resource: l,
      };
    }), [lessons]);

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
          style: { '--la-event-color': getEventColor ? getEventColor(event.resource) : 'var(--color-primary)' },
        })}
        onSelectEvent={(event) => onSelectLesson && onSelectLesson(event.resource)}
      />
    </div>
  );
}

export default Calendar;
