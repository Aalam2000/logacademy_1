// Поле формы: подпись + инпут + ошибка. Замена ad-hoc хелперов вроде
// f(field, label, type) в ProfilePage и userFields.map(...) в AdminPage.
import React from 'react';
import Input from './Input';

function FormField({ label, error, children, ...inputProps }) {
  return (
    <div className="form-field">
      {label && <label className="form-field__label">{label}</label>}
      {children || <Input error={error} {...inputProps} />}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export default FormField;
