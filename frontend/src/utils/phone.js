// Телефон ученика — азербайджанский стандарт: «+994 50 123 45 67» или
// «050 123 45 67» (пробелы, скобки и дефисы допускаются). Та же проверка —
// на бэкенде (backend/app/phones.py), там же запрет повторов.
export const PHONE_PLACEHOLDER = '+994 50 123 45 67';

export function isValidPhone(raw) {
  const s = (raw || '').replace(/[\s\-()]/g, '');
  return /^\+994\d{9}$/.test(s) || /^0\d{9}$/.test(s);
}

// Текст ошибки регистрации по ответу сервера
export function registerErrorText(err, fallback) {
  const status = err?.response?.status;
  if (status === 400) return 'Пользователь с таким логином уже существует';
  if (status === 404) return 'Приглашение недействительно';
  if (status === 409) return 'Этот телефон уже зарегистрирован. Войдите под своим логином или обратитесь к педагогу';
  if (status === 422) return 'Введите номер в формате +994 50 123 45 67 или 050 123 45 67';
  return err?.response?.data?.detail || fallback;
}
