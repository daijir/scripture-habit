export const NOTE_PREFIX_NOTE = '📖 **New Study Note**';
export const NOTE_PREFIX_ENTRY = '📖 **New Study Entry**';
export const NOTE_PREFIX_BASE = '📖 **New Study';

export const NOTE_HEADER_REGEX = /^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/;
export const NEW_STUDY_NOTE_REGEX = /📖 \*\*New Study Note\*\*\n+/;
export const NEW_STUDY_ENTRY_REGEX = /📖 \*\*New Study Entry\*\*\n+/;

export const removeNoteHeader = (text) => {
    if (!text) return '';
    return text.replace(NOTE_HEADER_REGEX, '');
};

export const hasNoteHeader = (text) => {
    if (!text) return false;
    return NOTE_HEADER_REGEX.test(text);
};

export const isLegacyNote = (text) => {
    return text && text.includes('New Study Entry');
};
