export const safeStorage = {
    get: (key: string, defaultValue: string | null = null): string | null => {
        try {
            const item = window.localStorage.getItem(key);
            return item !== null ? item : defaultValue;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return defaultValue;
        }
    },
    set: (key: string, value: string): boolean => {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    },
    remove: (key: string): boolean => {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    }
};
