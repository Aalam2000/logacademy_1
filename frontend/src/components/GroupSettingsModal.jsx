// Настройки группы, доступные педагогу: название, Telegram, WhatsApp,
// ссылка на видеоконференцию, длительность урока по умолчанию
// (PATCH /groups/{id}/settings).
import React, { useState } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import DurationSelect from './DurationSelect';
import { updateGroupSettings } from '../api/groups';
import { DEFAULT_DURATION_MIN } from '../utils/lessonTime';

function GroupSettingsModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: group.name || '',
    telegram_chat_id: group.telegram_chat_id || '',
    whatsapp: group.whatsapp || '',
    video_url: group.video_url || '',
    lesson_duration_min: group.lesson_duration_min || DEFAULT_DURATION_MIN,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const videoError = form.video_url.trim() && !/^https:\/\//i.test(form.video_url.trim())
    ? 'Ссылка должна начинаться с https://'
    : '';

  const save = async () => {
    if (!form.name.trim()) { setError('Введите название группы'); return; }
    if (videoError) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateGroupSettings(group.id, form);
      onSaved(updated);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? (detail[0]?.msg || 'Ошибка') : (detail || 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={'Настройки группы'}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn--secondary" onClick={onClose}>{'Отмена'}</button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      )}
    >
      <FormField label={'Название'} value={form.name} onChange={set('name')} />
      <FormField label={'Telegram (@группа или ссылка t.me/…)'} value={form.telegram_chat_id} onChange={set('telegram_chat_id')} />
      <FormField label={'WhatsApp (номер или ссылка на группу)'} value={form.whatsapp} onChange={set('whatsapp')} />
      <FormField
        label={'Ссылка на видеоконференцию'}
        placeholder="https://meet.google.com/abc-defg-hij"
        value={form.video_url}
        onChange={set('video_url')}
        error={videoError}
      />
      <FormField label={'Длительность урока по умолчанию (для новых уроков)'}>
        <DurationSelect
          value={form.lesson_duration_min}
          onChange={min => setForm(f => ({ ...f, lesson_duration_min: min }))}
        />
      </FormField>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

export default GroupSettingsModal;
