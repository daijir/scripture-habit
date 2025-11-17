import React from 'react';
import './Button.css';

const Button = ({ children, onClick, type = 'button', disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="GlassButton"
    >
      {children}
    </button>
  );
};

export default Button;