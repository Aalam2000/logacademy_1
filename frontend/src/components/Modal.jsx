// Общая обёртка модалки: подложка + окно + заголовок + подвал с кнопкой
// закрытия. Окно не выше экрана: заголовок и кнопки стоят на месте,
// прокручивается только содержимое (.modal-body). Раньше этот код был скопирован 1-в-1 в QRModal.jsx и
// StudentsModal.jsx.
import React from 'react';

function Modal({ title, onClose, children, footer, size, centered }) {
  const sizeClass = size === 'wide' ? ' modal-window--wide' : size === 'xwide' ? ' modal-window--xwide' : '';
  const windowClass = `modal-window${sizeClass}${centered ? ' modal-window--center' : ''}`;
  const actionsClass = `modal-actions${centered ? ' modal-actions--center' : ''}`;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={windowClass} onClick={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">{children}</div>
        <div className={actionsClass}>
          {footer || (
            <button className="btn btn--secondary" onClick={onClose}>
              {'Закрыть'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;
