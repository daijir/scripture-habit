import React, { createContext, useState, useContext } from 'react';
import { translations } from '../Data/Translations.js';
import { safeStorage } from '../Utils/storage';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Load language from localStorage, default to 'en'
    // Load language from localStorage, default to browser language or 'en'
    const [language, setLanguageState] = useState(() => {
        const saved = safeStorage.get('language');
        if (saved) return saved;

        // Auto-detect browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const shortLang = browserLang ? browserLang.split('-')[0].toLowerCase() : 'en';

        // Map supported codes
        const supported = ['en', 'ja', 'pt', 'zho', 'zh', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];

        if (shortLang === 'zh') return 'zho'; // Map Chinese
        if (supported.includes(shortLang)) return shortLang;

        return 'en';
    });

    // Wrapper to save to localStorage when language changes
    const setLanguage = (newLanguage) => {
        safeStorage.set('language', newLanguage);
        setLanguageState(newLanguage);
    };

    const t = (key, replacements = {}) => {
        const keys = key.split('.');
        let value = translations[language];
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        // Handle variable replacement
        if (typeof value === 'string' && replacements) {
            Object.keys(replacements).forEach(replaceKey => {
                value = value.replace(`{${replaceKey}}`, replacements[replaceKey]);
            });
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
