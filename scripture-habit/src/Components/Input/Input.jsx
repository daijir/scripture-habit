import React from 'react';
import './Input.css';

const Input = ({ label, type = 'text', value, onChange, required = false }) => {
  return (
    <div className="GlassInputContainer">
      {label && <label>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="GlassInput"
      />
    </div>
  );
};

export default Input;