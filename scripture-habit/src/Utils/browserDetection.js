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

export const handleLineRedirect = () => {
    if (detectInAppBrowser() === 'line') {
        if (window.location.search.indexOf('openExternalBrowser=1') === -1) {
            const separator = window.location.search ? '&' : '?';
            window.location.href = window.location.href + separator + 'openExternalBrowser=1';
            return true;
        }
    }
    return false;
};
