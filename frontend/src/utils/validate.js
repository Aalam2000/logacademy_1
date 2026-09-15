// Простая валидация форм: набор билдеров правил + функция проверки.
// Схема: { fieldName: [rule1, rule2, ...] }, каждое правило — функция
// (value, allValues) => сообщение об ошибке | null.
//
// Строки сообщений извлекаются autoi18n напрямую (доработан extract.js —
// любая функция, импортированная отсюда, считается текстоносной).

export function required(message = 'Обязательное поле') {
  return (value) => {
    if (value === undefined || value === null) return message;
    if (String(value).trim() === '') return message;
    return null;
  };
}

export function minLength(len, message) {
  const msg = message || `Минимум ${len} символов`;
  return (value) => {
    if (value && String(value).length < len) return msg;
    return null;
  };
}

export function matches(otherValue, message = 'Значения не совпадают') {
  return (value) => (value !== otherValue ? message : null);
}

export function validate(values, schema) {
  const errors = {};
  for (const field of Object.keys(schema)) {
    for (const rule of schema[field]) {
      const err = rule(values[field], values);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return errors;
}
