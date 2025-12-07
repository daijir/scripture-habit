import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempFilePath = path.join(__dirname, 'temp_jp_data.js');
const targetFilePath = path.join(__dirname, '../src/Utils/generalConferenceMapping.js');

try {
    const tempData = fs.readFileSync(tempFilePath, 'utf8');
    const targetData = fs.readFileSync(targetFilePath, 'utf8');

    // Extract the content of talkTitlesJa from temp file
    // Assumes format: export const talkTitlesJa = { ... };
    const tempMatch = tempData.match(/export const talkTitlesJa = \{([\s\S]*?)\};/);
    if (!tempMatch) {
        throw new Error('Could not find talkTitlesJa object in temp file.');
    }
    const jpTitlesContent = tempMatch[1]; // The content inside the braces

    // Replace the content in the target file
    // Assumes format: export const talkTitlesJa = { ... };
    const targetMatch = targetData.match(/export const talkTitlesJa = \{([\s\S]*?)\};/);
    if (!targetMatch) {
        throw new Error('Could not find talkTitlesJa object in target file.');
    }

    const newTargetData = targetData.replace(
        /export const talkTitlesJa = \{([\s\S]*?)\};/,
        `export const talkTitlesJa = {${jpTitlesContent}};`
    );

    fs.writeFileSync(targetFilePath, newTargetData, 'utf8');
    console.log('Successfully merged Japanese talk titles into generalConferenceMapping.js');

} catch (error) {
    console.error('Error merging files:', error);
    process.exit(1);
}
