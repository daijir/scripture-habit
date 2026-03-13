import React from 'react';
import './Checkbox.css';

const Checkbox = ({
    label,
    type = 'checkbox',
    id,
    checked,
    onChange
}) => {
  return (
          <div className="Checkbox">
            <input
                type={type}
                id={id}
                checked={checked}
                onChange={onChange}
            />
             {label && <label htmlFor={id}>{label}</label>}
          </div>
  );
};

export default Checkbox;