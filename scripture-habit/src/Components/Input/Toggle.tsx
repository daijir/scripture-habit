
import React from 'react';
import './Toggle.css';

const Toggle = ({ label, id, checked, onChange }) => {
    return (
        <div className="toggle-container">
            {label && <label className="toggle-label" htmlFor={id}>{label}</label>}
            <div className="toggle-switch">
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    onChange={onChange}
                    className="toggle-input"
                />
                <label className="toggle-slider" htmlFor={id}>
                    <span className="toggle-button" />
                </label>
            </div>
        </div>
    );
};

export default Toggle;
