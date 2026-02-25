import React, { useState, useEffect } from 'react';
import { UilMultiply, UilShare, UilPlusSquare, UilApps } from '@iconscout/react-unicons';
import { useLocation } from 'react-router-dom';
import { useLanguage, SUPPORTED_LANGUAGES } from '../../Context/LanguageContext';
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
            console.log('[PWA] beforeinstallprompt event fired');
            // Prevent Chrome 76 and later from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setPlatform('android');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if the event was already captured globally (in main.jsx)
        if (window.deferredPWAPrompt) {
            console.log('[PWA] Using global deferred prompt');
            handleBeforeInstallPrompt(window.deferredPWAPrompt);
            // DO NOT set to null so Profile.jsx can also access it
        }

        // Immediate platform detection
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        console.log('[PWA] Detection:', { isIOS, isAndroid, isStandalone, ua });

        if (!isStandalone) {
            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // Handle showing/hiding the prompt based on route and state
    useEffect(() => {
        const path = location.pathname;
        const pathParts = path.split('/').filter(Boolean);

        // Determine the base path regardless of language prefix
        let base = path;
        const firstPart = pathParts[0];
        if (SUPPORTED_LANGUAGES.includes(firstPart)) {
            base = '/' + pathParts.slice(1).join('/');
        }

        // Normalize to handle trailing slashes
        if (base !== '/' && base.endsWith('/')) {
            base = base.slice(0, -1);
        }

        const isDashboard = base === '/dashboard';
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        // Check for 7-day cooldown in localStorage
        let hasDismissed = false;
        const dismissedAt = localStorage.getItem('pwaInstallPromptDismissedAt');
        if (dismissedAt) {
            const dismissedDate = new Date(dismissedAt);
            const now = new Date();
            const daysSinceDismissed = (now - dismissedDate) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                hasDismissed = true;
            } else {
                // Cooldown expired, clear it so we can show it again
                localStorage.removeItem('pwaInstallPromptDismissedAt');
            }
        }

        console.log('[PWA] Status:', { base, isDashboard, hasDismissed, isStandalone, platform });

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
                console.log('[PWA] Showing iOS Prompt');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname, platform, deferredPrompt]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the native browser install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        await deferredPrompt.userChoice;

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
        localStorage.setItem('pwaInstallPromptDismissedAt', new Date().toISOString());
    };

    const handleClose = () => {
        setShowPrompt(false);
        localStorage.setItem('pwaInstallPromptDismissedAt', new Date().toISOString());
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

