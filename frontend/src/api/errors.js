// Общий разбор ошибок API — вместо того чтобы в каждой странице вручную
// писать err?.response?.data?.detail (было продублировано в 7 файлах).
export function getErrorMessage(err, fallback = 'Ошибка запроса') {
  return err?.response?.data?.detail || fallback;
}
