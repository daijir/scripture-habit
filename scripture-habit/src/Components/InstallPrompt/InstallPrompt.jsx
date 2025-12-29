import React, { useState, useEffect } from 'react';
import { UilMultiply, UilShare, UilPlusSquare, UilApps } from '@iconscout/react-unicons';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import './InstallPrompt.css';

const InstallPrompt = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [platform, setPlatform] = useState(null);

    useEffect(() => {
        // Android/Chrome logic
        const handleBeforeInstallPrompt = (e) => {
            // Prevent Chrome 76 and later from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setPlatform('android');

            const isDashboard = location.pathname === '/dashboard';
            const hasDismissed = sessionStorage.getItem('pwaInstallPromptDismissed');

            if (isDashboard && !hasDismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // iOS Check
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const isDashboard = location.pathname === '/dashboard';
        const hasDismissed = sessionStorage.getItem('pwaInstallPromptDismissed');

        if (isIOS && !isStandalone && !hasDismissed && isDashboard && platform !== 'android') {
            setPlatform('ios');
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
            return () => clearTimeout(timer);
        }

        // Hide if navigating away from dashboard
        if (!isDashboard) {
            setShowPrompt(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, [location.pathname, platform]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the native browser install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
        sessionStorage.setItem('pwaInstallPromptDismissed', 'true');
    };

    const handleClose = () => {
        setShowPrompt(false);
        sessionStorage.setItem('pwaInstallPromptDismissed', 'true');
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

            {platform === 'ios' ? (
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
                    {/* Visual pointer to bottom share bar on iOS Safari */}
                    <div className="triangle-pointer"></div>
                </div>
            ) : (
                <div className="install-android">
                    <p style={{ color: '#4a5568', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
                        {t('installPrompt.description')}
                    </p>
                    <button className="pwa-install-button" onClick={handleInstallClick}>
                        <UilApps size="20" />
                        {t('installPrompt.installButton')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default InstallPrompt;

