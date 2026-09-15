// Кнопка
import React from 'react';

function Button({ children, onClick, variant = 'primary', className = '', ...props }) {
  const variantClass = variant && variant !== 'primary' ? ` btn--${variant}` : '';
  const classes = `btn${variantClass}${className ? ' ' + className : ''}`;
  return (
    <button onClick={onClick} className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
