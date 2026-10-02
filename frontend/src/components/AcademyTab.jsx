// Вкладка «Академия» на странице админа: данные академии (название, сайт,
// контакты) и справочник секторов. Видит только админ.
//
// Сектор: код (не меняется после создания — хранится у групп и материалов),
// название и «название урока» — слово, с которого начинаются названия
// уроков в группах этого сектора («Урок 5», «Dərs 5»).
// Код сектора = язык интерфейса (языки задаются в .env на сервере): в окне
// «Новый сектор» выбирается язык, у которого сектора ещё нет; когда все
// языки заняты, добавить сектор нельзя.
import React, { useEffect, useState } from 'react';
import Button from './Button';
import Modal from './Modal';
import IconButton from './IconButton';
import {
  getAcademy, updateAcademy, createSector, updateSector, deleteSector, getSectorLanguages,
} from '../api/academy';
import { setAcademyName } from '../utils/academyName';
import { extractErrorMessage } from '../utils/errors';

const emptyAcademy = {
  name: '', website: '', telegram: '', whatsapp: '', instagram: '', address: '', phone: '', email: '',
};
const emptySector = { code: '', name: '', lesson_word: '' };

function AcademyTab({ sectors, onSectorsChanged, onError }) {
  const [academy, setAcademy] = useState(emptyAcademy);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSector, setNewSector] = useState(emptySector);
  const [editingCode, setEditingCode] = useState(null);
  const [draft, setDraft] = useState({ name: '', lesson_word: '' });
  const [busy, setBusy] = useState(false);
  const [freeLanguages, setFreeLanguages] = useState(null); // языки интерфейса без сектора; null — ещё не загружены
  const noFreeLanguages = Array.isArray(freeLanguages) && freeLanguages.length === 0;

  const fail = (err, fallback) => onError(extractErrorMessage(err, fallback));

  useEffect(() => {
    getAcademy()
      .then(data => {
        const filled = { ...emptyAcademy };
        Object.keys(filled).forEach(k => { filled[k] = data[k] || ''; });
        setAcademy(filled);
      })
      .catch(err => fail(err, 'Не удалось загрузить данные компании'));
    // eslint-disable-next-line
  }, []);

  // Свободные языки пересчитываются при каждом изменении списка секторов
  useEffect(() => {
    getSectorLanguages()
      .then(data => setFreeLanguages(data.available || []))
      .catch(() => setFreeLanguages([]));
  }, [sectors]);

  const openAdd = () => {
    setNewSector({ ...emptySector, code: freeLanguages?.[0] || '' });
    setIsAddOpen(true);
  };

  const field = (key, label, placeholder, wide) => (
    <label className={`field-label${wide ? ' form-grid__wide' : ''}`}>
      {label}
      <input
        className="input"
        autoComplete="off"
        placeholder={placeholder}
        value={academy[key]}
        onChange={e => { setAcademy({ ...academy, [key]: e.target.value }); setSavedNotice(false); }}
      />
    </label>
  );

  const saveAcademy = async () => {
    if (!academy.name.trim()) {
      onError('Укажите название компании');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await updateAcademy(academy);
      setAcademyName(saved.name);
      setSavedNotice(true);
    } catch (err) {
      fail(err, 'Не удалось сохранить данные компании');
    } finally {
      setIsSaving(false);
    }
  };

  const isNewSectorValid = newSector.code.trim() && newSector.name.trim() && newSector.lesson_word.trim();

  const addSector = async () => {
    if (!isNewSectorValid) return;
    setBusy(true);
    try {
      await createSector(newSector);
      setIsAddOpen(false);
      setNewSector(emptySector);
      await onSectorsChanged();
    } catch (err) {
      fail(err, 'Не удалось добавить сектор');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s) => {
    setEditingCode(s.code);
    setDraft({ name: s.name, lesson_word: s.lesson_word });
  };

  const saveEdit = async () => {
    if (!draft.name.trim() || !draft.lesson_word.trim()) {
      onError('Заполните название сектора и название урока');
      return;
    }
    setBusy(true);
    try {
      await updateSector(editingCode, draft);
      setEditingCode(null);
      await onSectorsChanged();
    } catch (err) {
      fail(err, 'Не удалось сохранить сектор');
    } finally {
      setBusy(false);
    }
  };

  const removeSector = async (s) => {
    if (!window.confirm(`Удалить сектор «${s.name}»?`)) return;
    setBusy(true);
    try {
      await deleteSector(s.code);
      await onSectorsChanged();
    } catch (err) {
      fail(err, 'Не удалось удалить сектор');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-layout">
      <div className="settings-panel">
        <div className="settings-panel__head">
          <h3 className="settings-panel__title">{'Данные компании'}</h3>
        </div>
        <div className="form-grid">
          {field('name', 'Название', 'Log Academy', true)}
          {field('website', 'Сайт', 'https://...')}
          {field('email', 'E-mail', '')}
          {field('phone', 'Телефон', '')}
          {field('whatsapp', 'WhatsApp', '')}
          {field('telegram', 'Канал новостей в Telegram', 'https://t.me/...')}
          {field('instagram', 'Instagram', '')}
          {field('address', 'Адрес', '', true)}
        </div>
        <div className="settings-panel__foot">
          {savedNotice && <span className="text-muted">{'Сохранено'}</span>}
          <Button onClick={saveAcademy} disabled={isSaving}>{isSaving ? 'Сохранение...' : 'Сохранить'}</Button>
        </div>
      </div>

      <div className="settings-panel">
        <div className="settings-panel__head">
          <h3 className="settings-panel__title">{'Секторы'}</h3>
          <Button
            onClick={openAdd}
            disabled={!freeLanguages || noFreeLanguages}
          >
            {'+ Добавить сектор'}
          </Button>
        </div>
        {noFreeLanguages && (
          <p className="text-muted">
            {'У каждого языка интерфейса уже есть сектор. Чтобы добавить сектор, сначала добавьте язык в настройках сервера.'}
          </p>
        )}
      <div className="table-scroll">
        <table className="table">
          <thead><tr>
            <th>{'Язык'}</th>
            <th>{'Название'}</th>
            <th data-tip={'С этого слова начинаются названия уроков в группах сектора'}>{'Название урока'}</th>
            <th></th>
          </tr></thead>
          <tbody>
            {sectors.length === 0 && (
              <tr><td colSpan="4" className="table__empty">{'Секторов пока нет'}</td></tr>
            )}
            {sectors.map(s => (
              <tr
                key={s.code}
                onClick={() => { if (editingCode !== s.code && !busy) startEdit(s); }}
                className="table__row--clickable"
              >
                <td>{s.code}</td>
                <td>
                  {editingCode === s.code ? (
                    <input className="input" value={draft.name}
                      onChange={e => setDraft({ ...draft, name: e.target.value })} />
                  ) : s.name}
                </td>
                <td>
                  {editingCode === s.code ? (
                    <input className="input" size={10} value={draft.lesson_word}
                      onChange={e => setDraft({ ...draft, lesson_word: e.target.value })} />
                  ) : s.lesson_word}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  {editingCode === s.code ? (
                    <div className="button-row">
                      <button type="button" className="btn btn--sm" onClick={saveEdit} disabled={busy}>
                        {'Сохранить'}
                      </button>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => setEditingCode(null)} disabled={busy}>
                        {'Отмена'}
                      </button>
                    </div>
                  ) : (
                    <IconButton icon="delete" variant="danger" tip={'Удалить сектор'} disabled={busy} onClick={() => removeSector(s)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {isAddOpen && (
        <Modal title={'Новый сектор'} onClose={() => setIsAddOpen(false)} footer={(
          <>
            <button className="btn btn--secondary" onClick={() => setIsAddOpen(false)}>{'Отмена'}</button>
            <Button onClick={addSector} disabled={!isNewSectorValid || busy}>{'Добавить'}</Button>
          </>
        )}>
          <div className="form-stack">
            <label className="field-label">
              {'Язык сектора'}
              <select className="input input--min160" value={newSector.code}
                onChange={e => setNewSector({ ...newSector, code: e.target.value })}>
                {(freeLanguages || []).map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
            </label>
            <input placeholder={'Название сектора'} className="input input--min160"
              autoComplete="off"
              value={newSector.name}
              onChange={e => setNewSector({ ...newSector, name: e.target.value })}
            />
            <input placeholder={'Название урока в этом секторе, например: Сабақ'} className="input input--min160"
              autoComplete="off"
              value={newSector.lesson_word}
              onChange={e => setNewSector({ ...newSector, lesson_word: e.target.value })}
            />
            <p className="text-muted">{'Язык сектора после создания изменить нельзя.'}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AcademyTab;
