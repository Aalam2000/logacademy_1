// Общая обёртка модалки: подложка + окно + заголовок + подвал с кнопкой
// закрытия. Раньше этот код был скопирован 1-в-1 в QRModal.js и
// StudentsModal.js.
import React from 'react';

function Modal({ title, onClose, children, footer, size, centered }) {
  const windowClass = `modal-window${size === 'wide' ? ' modal-window--wide' : ''}${centered ? ' modal-window--center' : ''}`;
  const actionsClass = `modal-actions${centered ? ' modal-actions--center' : ''}`;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={windowClass} onClick={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
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
