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
    // We disable automatic redirects because they often cause white screens or hang-ups
    // especially in the LINE in-app browser on iOS.
    // Instead, we show a BrowserWarningModal.
    return false;
};

export const getLineExternalUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('openExternalBrowser', '1');
    return url.toString();
};

export const getAndroidIntentUrl = () => {
    const url = window.location.href.replace(/^https?:\/\//, '');
    return `intent://${url}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
};
