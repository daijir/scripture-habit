export const safeStorage = {
    get: (key, defaultValue = null) => {
        try {
            const item = window.localStorage.getItem(key);
            return item !== null ? item : defaultValue;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    },
    remove: (key) => {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    }
};
