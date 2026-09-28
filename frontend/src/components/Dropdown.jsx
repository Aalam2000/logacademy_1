import React, { useState, useRef, useEffect } from 'react';

// Кастомный дропдаун — триггер в стиле подчёркнутого текста (как .tab--underline),
// панель показывает не больше ~7 строк, дальше появляется скролл.
function Dropdown({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const current = options.find(o => String(o.value) === String(value));
  const label = current ? current.label : placeholder;

  const handleSelect = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className={`tab tab--underline${value ? ' tab--active' : ''}${disabled ? ' dropdown__trigger--disabled' : ''}`}
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
      >
        {label}
        <span className="dropdown__caret">{'▾'}</span>
      </button>
      {open && (
        <div className="dropdown__panel">
          <button type="button" className="dropdown__option" onClick={() => handleSelect('')}>
            {placeholder}
          </button>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              className={`dropdown__option${String(o.value) === String(value) ? ' dropdown__option--active' : ''}`}
              onClick={() => handleSelect(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
