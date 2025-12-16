import React from 'react';
import './Input.css';

const Input = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  as = 'input',
  placeholder = '',
  min,
}) => {

  const Component = as === 'textarea' ? 'textarea' : 'input';

  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="GlassInputContainer">
      {label && <label htmlFor={inputId}>{label}</label>}

      <Component
        id={inputId}
        type={as === 'textarea' ? undefined : type}
        value={value}
        onChange={onChange}
        required={required}
        className="GlassInput"
        placeholder={placeholder}
        min={min}
      />
    </div>
  );
};

export default Input;