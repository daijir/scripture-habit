import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../Data/Translations.js';
import { safeStorage } from '../Utils/storage';

const LanguageContext = createContext();

export const SUPPORTED_LANGUAGES = ['en', 'ja', 'pt', 'zho', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];

export const LanguageProvider = ({ children }) => {
    const navigate = useNavigate();
    // Helper to get initial language
    const getInitialLanguage = () => {
        // 1. Check URL path
        const pathParts = window.location.pathname.split('/');
        const urlLang = pathParts[1];
        if (SUPPORTED_LANGUAGES.includes(urlLang)) {
            return urlLang;
        }

        // 2. Check localStorage
        const saved = safeStorage.get('language');
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;

        // 3. Auto-detect browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const shortLang = browserLang ? browserLang.split('-')[0].toLowerCase() : 'en';

        if (shortLang === 'zh') return 'zho'; // Map Chinese
        if (SUPPORTED_LANGUAGES.includes(shortLang)) return shortLang;

        return 'en';
    };

    const [language, setLanguageState] = useState(getInitialLanguage);

    // Sync language with URL if it changes via something other than setLanguage (e.g. back button)
    useEffect(() => {
        const handlePathChange = () => {
            const pathParts = window.location.pathname.split('/');
            const urlLang = pathParts[1];
            if (SUPPORTED_LANGUAGES.includes(urlLang) && urlLang !== language) {
                setLanguageState(urlLang);
            }
        };

        window.addEventListener('popstate', handlePathChange);
        return () => window.removeEventListener('popstate', handlePathChange);
    }, [language]);

    // Wrapper to save to localStorage and optionally update URL
    const setLanguage = (newLanguage) => {
        if (!SUPPORTED_LANGUAGES.includes(newLanguage)) return;

        safeStorage.set('language', newLanguage);
        setLanguageState(newLanguage);

        // Update URL to include language prefix if not already there
        const pathParts = window.location.pathname.split('/');
        const currentPrefix = pathParts[1];

        if (SUPPORTED_LANGUAGES.includes(currentPrefix)) {
            pathParts[1] = newLanguage;
        } else {
            pathParts.splice(1, 0, newLanguage);
        }

        const newPath = pathParts.join('/') || '/';
        navigate(newPath);
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
