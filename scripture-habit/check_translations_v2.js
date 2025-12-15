const fs = require('fs');
const path = require('path');

const translationPath = path.join(__dirname, 'src', 'Data', 'Translations.js');

try {
    let content = fs.readFileSync(translationPath, 'utf8');

    // Replace export syntax with CommonJS to allow requiring in this script
    content = content.replace('export const translations =', 'module.exports =');

    const tempPath = path.join(__dirname, 'temp_translations.js');
    fs.writeFileSync(tempPath, content);

    const translations = require(tempPath);

    const languages = Object.keys(translations);
    const baseLang = 'ja';

    if (!languages.includes(baseLang)) {
        console.error(`Error: Base language '${baseLang}' not found in translations.`);
        process.exit(1);
    }

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

    // Cleanup
    try {
        fs.unlinkSync(tempPath);
    } catch (e) {
        // ignore
    }

} catch (error) {
    console.error("An error occurred:", error);
}
