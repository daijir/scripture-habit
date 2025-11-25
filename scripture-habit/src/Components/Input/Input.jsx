import React from 'react';
import './Input.css';

const Input = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  required = false,
  as ='input',
  placeholder = '',
  min,
}) => {

  const Component = as === 'textarea' ? 'textarea' : 'input';

  return (
    <div className="GlassInputContainer">
      {label && <label>{label}</label>}

      <Component
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