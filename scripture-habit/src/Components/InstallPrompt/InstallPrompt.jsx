import React, { useState, useEffect } from 'react';
import { UilMultiply, UilShare, UilPlusSquare } from '@iconscout/react-unicons';
import { useLanguage } from '../../Context/LanguageContext';
import './InstallPrompt.css';

const InstallPrompt = () => {
    const { t } = useLanguage();
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        // Check if user has already dismissed the prompt
        // Use session storage so it reminds them again next session/reload if they didn't install
        // Or local storage to respect their choice longer
        const hasDismissed = sessionStorage.getItem('iosInstallPromptDismissed');

        if (isIOS && !isStandalone && !hasDismissed) {
            // Delay slightly to let the page load
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000); // 3 seconds delay
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setShowPrompt(false);
        sessionStorage.setItem('iosInstallPromptDismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="install-prompt-overlay">
            <div className="install-header">
                <h3>{t('installPrompt.title')}</h3>
                <button className="close-btn" onClick={handleClose}>
                    <UilMultiply size="20" />
                </button>
            </div>

            <div className="install-steps">
                <div className="step">
                    <UilShare size="24" className="step-icon" style={{ color: '#007AFF' }} />
                    <span className="step-text">
                        {t('installPrompt.instruction1')}
                    </span>
                </div>
                <div className="step">
                    <UilPlusSquare size="24" className="step-icon" style={{ color: '#4a5568' }} />
                    <span className="step-text">
                        {t('installPrompt.instruction2')}
                    </span>
                </div>
            </div>

            {/* Visual pointer to bottom share bar */}
            <div className="triangle-pointer"></div>
        </div>
    );
};

export default InstallPrompt;
