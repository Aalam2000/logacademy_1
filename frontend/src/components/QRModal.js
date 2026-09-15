import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from './Modal';

function QRModal({ group, onClose }) {
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
    <Modal title={'Регистрация в группу'} onClose={onClose} centered>
      <p className="text-muted">{group.name}</p>

      <div className="qr-frame">
        <QRCodeSVG value={inviteLink} size={220} />
      </div>

      <div className="input-row">
        <input
          className="input input--soft"
          value={inviteLink}
          readOnly
          onFocus={e => e.target.select()}
        />
        <button className="btn" onClick={handleCopy}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      <p className="hint-text">
        {'Отправьте эту ссылку или QR-код ученикам для регистрации в группе'}
      </p>
    </Modal>
  );
}

export default QRModal;
