export const detectInAppBrowser = () => {
    // For testing: allow overriding via URL parameter ?debugBrowser=instagram
    const urlParams = new URLSearchParams(window.location.search);
    const debugBrowser = urlParams.get('debugBrowser');
    if (debugBrowser) return debugBrowser;

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/Line\//i.test(ua)) return 'line';
    if (/Instagram/i.test(ua)) return 'instagram';

    // Distinguish between Facebook and Messenger
    if (/FBAN|FBAV/i.test(ua)) {
        if (/Messenger/i.test(ua)) return 'messenger';
        return 'facebook';
    }

    // Android-specific patterns
    if (/FB_IAB/i.test(ua)) {
        if (/MESSENGER/i.test(ua)) return 'messenger';
        return 'facebook';
    }

    if (/WhatsApp/i.test(ua)) return 'whatsapp';
    return null;
};

export const isInAppBrowser = () => {
    return !!detectInAppBrowser();
};

export const handleInAppBrowserRedirect = () => {
    const app = detectInAppBrowser();
    if (!app) return false;

    // LINE: Use built-in external browser parameter (This works automatically)
    if (app === 'line') {
        if (window.location.search.indexOf('openExternalBrowser=1') === -1) {
            const separator = window.location.search ? '&' : '?';
            window.location.href = window.location.href + separator + 'openExternalBrowser=1';
            return true;
        }
    }

    // Android/Instagram/FB: Automatic redirect often fails due to "User Gesture" requirements.
    // We will handle this via a button click in the BrowserWarningModal instead.
    return false;
};

export const getAndroidIntentUrl = () => {
    const url = window.location.href.replace(/^https?:\/\//, '');
    return `intent://${url}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
};
