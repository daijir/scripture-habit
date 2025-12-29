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

    // Capture beforeinstallprompt event and detect platform
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            console.log('beforeinstallprompt event fired (handled in component)');
            // Prevent Chrome 76 and later from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setPlatform('android');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if the event was already captured globally (in main.jsx)
        if (window.deferredPWAPrompt) {
            console.log('Using globally captured PWA prompt event');
            handleBeforeInstallPrompt(window.deferredPWAPrompt);
            window.deferredPWAPrompt = null; // Clear it to avoid double handling logic if any
        }

        // Detect if iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (isIOS && !isStandalone) {
            setPlatform('ios');
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // Handle showing/hiding the prompt based on route and state
    useEffect(() => {
        const isDashboard = location.pathname === '/dashboard';
        const hasDismissed = sessionStorage.getItem('pwaInstallPromptDismissed');
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (!isDashboard || hasDismissed || isStandalone) {
            setShowPrompt(false);
            return;
        }

        // Android logic: Show if we have the deferred prompt
        if (platform === 'android' && deferredPrompt) {
            setShowPrompt(true);
        }

        // iOS logic: Show after a short delay
        if (platform === 'ios') {
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname, platform, deferredPrompt]);

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
                        {t('installPrompt.title')} {/* Fallback to title or adding a specific key if needed, using Title "Install App" as button text is common */}
                    </button>
                </div>
            )}
        </div>
    );
};

export default InstallPrompt;

