// Поле ввода
import React from 'react';

function Input({ className = '', error, ...props }) {
  const classes = `input${error ? ' input--error' : ''}${className ? ' ' + className : ''}`;
  return <input className={classes} {...props} />;
}

export default Input;
