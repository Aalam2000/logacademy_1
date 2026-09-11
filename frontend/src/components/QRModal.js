import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../context/I18nContext';

function QRModal({ group, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const baseUrl = process.env.REACT_APP_PUBLIC_URL || window.location.origin;
  const inviteLink = `${baseUrl}/join/${group.invite_code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback для старых браузеров
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.title}>{t('group_qr_title', 'Регистрация в группу')}</h3>
        <p style={s.groupName}>{group.name}</p>

        <div style={s.qrWrap}>
          <QRCodeSVG value={inviteLink} size={220} />
        </div>

        <div style={s.linkRow}>
          <input
            style={s.linkInput}
            value={inviteLink}
            readOnly
            onFocus={e => e.target.select()}
          />
          <button style={s.copyBtn} onClick={handleCopy}>
            {copied ? t('copied', 'Скопировано') : t('copy', 'Копировать')}
          </button>
        </div>

        <p style={s.hint}>
          {t('group_qr_hint', 'Отправьте эту ссылку или QR-код ученикам для регистрации в группе')}
        </p>

        <div style={s.actions}>
          <button style={s.closeBtn} onClick={onClose}>
            {t('close', 'Закрыть')}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '100%', maxWidth: '420px', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 12px 32px rgba(0,0,0,0.2)', textAlign: 'center' },
  title: { margin: '0 0 0.25rem 0' },
  groupName: { margin: '0 0 1rem 0', color: '#4B5563', fontSize: '0.9rem' },
  qrWrap: { display: 'flex', justifyContent: 'center', padding: '1rem', background: '#f8fdfc', borderRadius: '12px', border: '1px solid #e8f4f0' },
  linkRow: { display: 'flex', gap: '8px', marginTop: '1rem' },
  linkInput: { flex: 1, padding: '8px 12px', border: '1px solid #c8f0ea', borderRadius: '8px', fontSize: '0.85rem', background: '#f8fdfc' },
  copyBtn: { padding: '8px 16px', background: '#3dbdaa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  hint: { fontSize: '0.8rem', color: '#6B7280', marginTop: '0.75rem' },
  actions: { marginTop: '1rem' },
  closeBtn: { padding: '8px 24px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};

export default QRModal;