// Блок «Ссылка для родителя» в карточке ученика (StudentCardModal.jsx).
// Ссылка принадлежит телефону родителя: по ней видны все его дети
// (backend/app/routers/parent.py). Создаёт педагог (ученику своих групп) или админ.
import React, { useEffect, useState } from 'react';
import { getParentLink, makeParentLink, parentLinkUrl } from '../api/parent';
import { whatsappHref } from './ContactIcons';
import { extractErrorMessage } from '../utils/errors';

function ParentLinkBlock({ studentId }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getParentLink(studentId).then(setData).catch(err => setError(extractErrorMessage(err, 'Не удалось загрузить ссылку')));
  }, [studentId]);

  const make = async (renew) => {
    if (renew && !window.confirm('Старая ссылка перестанет открываться. Создать новую?')) return;
    setBusy(true);
    setError('');
    try {
      setData(await makeParentLink(studentId, renew));
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось создать ссылку'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <div className="form-field__error">{error}</div> : null;
  if (!data.parent_phone) {
    return <div className="hint-text">{'Заполните телефон родителя и сохраните карточку — тогда можно будет создать ссылку.'}</div>;
  }

  const url = data.token ? parentLinkUrl(data.token) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const waBase = whatsappHref(data.parent_phone);
  const waText = `Здравствуйте! Успеваемость вашего ребёнка в Log Academy: ${url}`;
  const wa = waBase ? `${waBase}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div className="parent-link">
      {data.token ? (
        <>
          <div className="parent-link__url">{url}</div>
          <div className="button-row">
            <button type="button" className="btn btn--sm" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</button>
            {wa && <a className="btn btn--sm" href={wa} target="_blank" rel="noopener noreferrer">{'Отправить в WhatsApp'}</a>}
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => make(true)} disabled={busy}>{'Новая ссылка'}</button>
          </div>
          <div className="hint-text">
            {'По ссылке родитель видит без пароля: '}{data.children.join(', ') || '—'}{'. '}
            {data.last_used_at
              ? <>{'Открывали: '}{new Date(data.last_used_at).toLocaleString('ru-RU')}{'.'}</>
              : 'Ещё не открывали.'}
          </div>
        </>
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => make(false)} disabled={busy}>
          {busy ? 'Создаём…' : 'Создать ссылку для родителя'}
        </button>
      )}
      {error && <div className="form-field__error">{error}</div>}
    </div>
  );
}

export default ParentLinkBlock;
