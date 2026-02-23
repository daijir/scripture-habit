/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { safeStorage } from '../Utils/storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [fontSize, setFontSizeState] = useState(() => {
        const saved = safeStorage.get('fontSize');
        return saved || 'medium';
    });

    useEffect(() => {
        safeStorage.set('fontSize', fontSize);
        // Apply font size to document root
        const fontSizeMap = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'extraLarge': '20px'
        };
        document.documentElement.style.fontSize = fontSizeMap[fontSize] || '16px';
    }, [fontSize]);

    const setFontSize = React.useCallback((size) => {
        setFontSizeState(size);
    }, []);

    const contextValue = React.useMemo(() => ({
        fontSize,
        setFontSize
    }), [fontSize, setFontSize]);

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
