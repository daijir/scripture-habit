export const detectInAppBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/Line\//i.test(ua)) return 'line';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV/i.test(ua)) return 'messenger';
    if (/WhatsApp/i.test(ua)) return 'whatsapp';
    return null;
};

export const isInAppBrowser = () => {
    return !!detectInAppBrowser();
};

export const handleInAppBrowserRedirect = () => {
    const app = detectInAppBrowser();
    if (!app) return false;

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /Android/i.test(ua);

    // LINE: Use built-in external browser parameter
    if (app === 'line') {
        if (window.location.search.indexOf('openExternalBrowser=1') === -1) {
            const separator = window.location.search ? '&' : '?';
            window.location.href = window.location.href + separator + 'openExternalBrowser=1';
            return true;
        }
    }

    // Android: Use Intent URL to force open in default browser (Chrome)
    // This works for Instagram, Facebook, and Messenger on Android
    if (isAndroid && (app === 'instagram' || app === 'messenger' || app === 'facebook')) {
        const url = window.location.href.replace(/^https?:\/\//, '');
        window.location.href = `intent://${url}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
        return true;
    }

    return false;
};
