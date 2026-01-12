import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { safeStorage } from '../../Utils/storage';
import { useLanguage } from '../../Context/LanguageContext';
import './CookieConsent.css';

const CookieConsent = () => {
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = safeStorage.get('cookieConsent');
        if (!consent) {
            // Small delay to make it feel smooth
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        safeStorage.set('cookieConsent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="cookie-consent-banner">
            <div className="cookie-consent-content">
                <p>
                    {t('cookieConsent.message')}
                    <Link to="/privacy" className="privacy-link">
                        {t('cookieConsent.privacyPolicy')}
                    </Link>
                </p>
                <button className="accept-button" onClick={handleAccept}>
                    {t('cookieConsent.accept')}
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;
