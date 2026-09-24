// Обёртка над react-big-calendar — общий календарь уроков (Месяц/Неделя/
// День, как в Google Calendar). Внешний вид переопределён в
// ../styles/calendar.css под токены Log Academy.
//
// Компонент ничего не знает про «группы» — только рисует события. Кто
// вызывает (GroupPage — уроки одной группы, GroupsPage — все уроки
// препода сразу) сам решает, откуда взялись уроки и как их красить
// (getEventColor), и сам показывает список групп для выбора рядом —
// это не забота календаря.
import React, { useMemo, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ru';
import 'moment/locale/az';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendar.css';
import { useLang } from '../hooks/useLang';

// Локаль moment завязана на текущий язык интерфейса (useLang) — иначе
// названия месяцев/дней в сетке календаря (их рисует сам moment, а не
// autoi18n) всегда оставались бы русскими независимо от переключателя языка.
const MOMENT_LOCALE_BY_LANG = { ru: 'ru', az: 'az', en: 'en' };
const localizer = momentLocalizer(moment);

// MESSAGES передаётся как проп в react-big-calendar (не JSX-текст), поэтому
// autoi18n-сканер его в принципе не видит — переводим вручную, по языку.
// Слов немного и они фиксированные, так что платный AI-перевод тут ни к
// чему; az-варианты — стандартные календарные подписи (как в Google Calendar).
const MESSAGES_BY_LANG = {
  ru: {
    month: 'Месяц',
    week: 'Неделя',
    day: 'День',
    today: 'Сегодня',
    previous: 'Назад',
    next: 'Вперёд',
    noEventsInRange: 'Уроков нет',
    showMore: (count) => `ещё ${count}`,
  },
  az: {
    month: 'Ay',
    week: 'Həftə',
    day: 'Gün',
    today: 'Bu gün',
    previous: 'Geri',
    next: 'İrəli',
    noEventsInRange: 'Dərs yoxdur',
    showMore: (count) => `daha ${count}`,
  },
  en: {
    month: 'Month',
    week: 'Week',
    day: 'Day',
    today: 'Today',
    previous: 'Back',
    next: 'Next',
    noEventsInRange: 'No lessons',
    showMore: (count) => `+${count} more`,
  },
};

// Общая палитра для раскраски «по группе» — используется здесь через
// getEventColor и отдельно на GroupsPage.js для списка групп рядом с
// календарём, чтобы цвета совпадали.
export const GROUP_COLORS = ['#EC3013', '#2E5FA3', '#3B6D11', '#C026D3', '#0891B2', '#f59e0b', '#605D5D', '#059669'];

// lessons: [{id, group_id, group_name?, title, date}]
// getEventColor(lesson) => css-цвет; не задан — все события фирменным красным.
function Calendar({ lessons, onSelectLesson, getEventColor, defaultView = 'month' }) {
  const { lang } = useLang();
  const momentLocale = MOMENT_LOCALE_BY_LANG[lang] || 'ru';

  useEffect(() => {
    moment.locale(momentLocale);
  }, [momentLocale]);

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
        messages={MESSAGES_BY_LANG[momentLocale] || MESSAGES_BY_LANG.ru}
        culture={momentLocale}
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
