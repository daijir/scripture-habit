import React, { createContext, useState, useContext } from 'react';
import { translations } from '../Data/Translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Load language from localStorage, default to 'en'
    const [language, setLanguageState] = useState(() => {
        const saved = localStorage.getItem('language');
        return saved || 'en';
    });

    // Wrapper to save to localStorage when language changes
    const setLanguage = (newLanguage) => {
        localStorage.setItem('language', newLanguage);
        setLanguageState(newLanguage);
    };

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }
        return value;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
