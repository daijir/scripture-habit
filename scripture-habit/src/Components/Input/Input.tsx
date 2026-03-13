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
  ...rest
}) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const Component = as === 'textarea' ? 'textarea' : 'input';

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
        {...rest}
      />
    </div>
  );
};

export default Input;