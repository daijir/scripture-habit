/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { safeStorage } from '../Utils/storage';

export type FontSize = 'small' | 'medium' | 'large' | 'extraLarge';

interface SettingsContextType {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [fontSize, setFontSizeState] = useState<FontSize>(() => {
        const saved = safeStorage.get('fontSize') as FontSize;
        return saved || 'medium';
    });

    useEffect(() => {
        safeStorage.set('fontSize', fontSize);
        // Apply font size to document root
        const fontSizeMap: Record<FontSize, string> = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'extraLarge': '20px'
        };
        document.documentElement.style.fontSize = fontSizeMap[fontSize] || '16px';
    }, [fontSize]);

    const setFontSize = React.useCallback((size: FontSize) => {
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

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
