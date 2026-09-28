// Роутер /presence (backend/app/routers/presence.py) — присутствие в системе
import api from './auth';

export function sendPresencePing() {
  return api.post('/presence/ping');
}

// Все, кто заходил сегодня, с флажком is_online (активен за последние 10 мин)
export function getTodayUsers() {
  return api.get('/presence/today').then(res => res.data);
}

// params: { date_from, date_to, role?, group_id? } → { days: [...], totals: [...] }
export function getPresenceReport(params) {
  return api.get('/presence/report', { params }).then(res => res.data);
}
