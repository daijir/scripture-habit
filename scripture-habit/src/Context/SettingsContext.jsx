import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [fontSize, setFontSizeState] = useState(() => {
        const saved = localStorage.getItem('fontSize');
        return saved || 'medium';
    });

    useEffect(() => {
        localStorage.setItem('fontSize', fontSize);
        // Apply font size to document root
        const fontSizeMap = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'extraLarge': '20px'
        };
        document.documentElement.style.fontSize = fontSizeMap[fontSize] || '16px';
    }, [fontSize]);

    const setFontSize = (size) => {
        setFontSizeState(size);
    };

    return (
        <SettingsContext.Provider value={{ fontSize, setFontSize }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
