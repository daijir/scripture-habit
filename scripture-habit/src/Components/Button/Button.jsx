import React from 'react';
import './Button.css';

const Button = ({ children, onClick, type = 'button', disabled = false, className = '' }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`GlassButton ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;