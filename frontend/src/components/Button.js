// Кнопка
import React from 'react';

function Button({ children, onClick, style, ...props }) {
  return (
    <button onClick={onClick} style={{ ...styles.button, ...style }} {...props}>
      {children}
    </button>
  );
}

const styles = {
  button: {
    background: '#3dbdaa',
    color: 'white',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '12px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};

export default Button;