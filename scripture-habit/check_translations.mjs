import { translations } from './src/Data/Translations.js';

const languages = Object.keys(translations);
const baseLang = 'ja';
const targets = languages.filter(l => l !== baseLang);

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

const baseKeys = getKeys(translations[baseLang]);
let missingCount = 0;

console.log(`Checking against base language: ${baseLang}`);
console.log(`Total base keys: ${baseKeys.length}`);

targets.forEach(lang => {
    // Traverse target object manually to check existance, handling nested undefined
    const missing = [];
    baseKeys.forEach(keyPath => {
        const parts = keyPath.split('.');
        let current = translations[lang];
        for (const part of parts) {
            if (current === undefined || current === null) {
                current = undefined;
                break;
            }
            current = current[part];
        }
        if (current === undefined) {
            missing.push(keyPath);
        }
    });

    if (missing.length > 0) {
        console.log(`\n[${lang}] Missing ${missing.length} keys:`);
        missing.forEach(k => console.log(`  - ${k}`));
        missingCount += missing.length;
    } else {
        console.log(`\n[${lang}] OK`);
    }
});

if (missingCount === 0) {
    console.log("\nSuccess: All languages have all keys present in Japanese translation.");
} else {
    console.log(`\nFound total ${missingCount} missing translations.`);
}
