// Приводит ошибку axios-запроса к строке для показа пользователю.
//
// Обычные ошибки (HTTPException на бэке) приходят как detail: "текст" —
// строка. Но ошибки валидации Pydantic/FastAPI (422, например «оценка
// больше 100») приходят как detail: [{type, loc, msg, input, ctx, url}, ...]
// — массив объектов. Рендерить такой объект прямо в JSX нельзя — React
// падает с "Objects are not valid as a React child" (баг, пойманный на
// вводе оценки 200 на странице «Студенты», LessonPage).
export function extractErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(d => (typeof d === 'string' ? d : d?.msg)).filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
  return fallback;
}
