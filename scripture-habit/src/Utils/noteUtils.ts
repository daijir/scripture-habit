export const NOTE_PREFIX_NOTE = '📖 **New Study Note**';
export const NOTE_PREFIX_BASE = '📖 **New Study';

export const NOTE_HEADER_REGEX = /^(📖\s*.*?Study Note|📖\s*.*?学習ノート|📖\s*.*?Estudo Nota)/i;
export const NEW_STUDY_NOTE_REGEX = /📖\s*.*?Study Note\n+/i;

export const removeNoteHeader = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.replace(NOTE_HEADER_REGEX, '');
};

export const hasNoteHeader = (text: string | null | undefined): boolean => {
    if (!text) return false;
    return NOTE_HEADER_REGEX.test(text);
};

export const isLegacyNote = (text: string | null | undefined): boolean => {
    return !!(text && text.includes('New Study Entry'));
};
