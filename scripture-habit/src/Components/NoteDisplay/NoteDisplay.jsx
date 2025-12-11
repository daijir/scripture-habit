import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../Context/LanguageContext';
import { useGCMetadata } from '../../hooks/useGCMetadata';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../Utils/noteUtils';

// Helper to check if a string is likely a GC URL or Shortcode
const isGCUrl = (str) => {
    if (!str) return false;
    // URL check
    if (str.includes('churchofjesuschrist.org') && (str.includes('general-conference') || str.includes('study/general-conference'))) return true;
    // Shortcode check: "2023/04/nelson" or "2023/10/peacemakers-needed"
    // Regex: 4 digits / 2 digits / chars
    return /^\d{4}\/\d{2}\/.+$/.test(str);
};

const GCNoteRenderer = ({ parts, url, language, t, isSent }) => {
    const { data, loading } = useGCMetadata(url, language);

    const content = useMemo(() => {
        let displayContent = url;

        if (data && data.title) {
            let label = data.title;
            // Add speaker if available
            if (data.speaker) {
                // Formatting: "Title (Speaker)"
                // Note: Title often contains quote marks, we might want to ensure they are handled
                label = `"${data.title}" (${data.speaker})`;
            }
            // Just show the text, not a link
            displayContent = label;
        } else if (loading) {
            displayContent = `_Loading info..._`;
        }

        // Reconstruct message
        // header is like "📖 **Header**"
        // scripture is "**Scripture:** Value"
        // chapter line is "**Talk:** Value"
        // comment line is "**Comment:**"
        // comment body

        let headerTrans = parts.header;
        if (headerTrans.includes('New Study Note')) headerTrans = `📖 **${t('noteLabels.newStudyNote')}**`;
        if (headerTrans.includes('New Study Entry')) headerTrans = `📖 **${t('noteLabels.newStudyEntry')}**`;

        const scriptureLabel = t('noteLabels.scripture');
        const scriptureValue = t('scriptures.generalConference');
        const talkLabel = t('noteLabels.talk'); // "Talk" or "話"
        const commentLabel = t('noteLabels.comment');

        return `
${headerTrans}

**${scriptureLabel}:** ${scriptureValue}

**${talkLabel}:** ${displayContent}

**${commentLabel}:**
${parts.comment}
        `.trim();

    }, [data, loading, parts, url, language, t]);

    return (
        <ReactMarkdown
            components={{
                a: ({ node, ...props }) => (
                    <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: 'black',
                            textDecoration: 'none'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ),
                strong: ({ node, ...props }) => (
                    <strong {...props} style={{ color: 'inherit' }} />
                )
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

const NoteDisplay = ({ text, isSent }) => {
    const { language, t } = useLanguage();

    // 1. Parse content to see if it matches the structure
    // Regex based on "src/Components/GroupChat/GroupChat.jsx" formatNoteForDisplay

    // Header
    const headerMatch = text.match(NOTE_HEADER_REGEX);

    // If not a note, return standard markdown (or null if we only use this for notes)
    // But GroupChat uses this for ALL messages if we replace the renderer.
    // So we need to handle non-notes too.
    if (!headerMatch) {
        // Render as standard text with link detection
        // We can use ReactMarkdown directly for regular messages too!
        return (
            <ReactMarkdown
                components={{
                    a: ({ node, ...props }) => (
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: isSent ? 'white' : 'var(--purple)',
                                textDecoration: 'underline'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )
                }}
            >
                {text}
            </ReactMarkdown>
        );
    }

    const body = removeNoteHeader(text);

    // Extract fields
    // NOTE: This regex needs to match what is saved in NewNote.jsx aka "Original English" or localized if saved localized.
    // The current app saves in English tokens: "**Scripture:**", "**Chapter:**" etc?
    // Let's check NewNote.jsx: 
    // `messageText = \`📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**${label}:** ${chapter}\n\n${comment}\`;`
    // So it saves in mostly English tokens: "**Scripture:**", "**Chapter:**", "**Speech:**", "**Title:**".
    // Also handles "Other" which has no chapter.

    const scriptureMatch = body.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
    const chapterMatch = body.match(/\*\*(?:Chapter|Title|Speech):\*\* (.*?)(?:\n|$)/);

    // Detect if "Scripture" is "General Conference" (or localized variants if legacy)
    // The user's NewNote.jsx saves using the `scripture` variable which comes from `translatedScripturesOptions`.
    // Wait, `NewNote.jsx`: `translatedScripturesOptions` maps value to `label`.
    // But `setScripture(option.value)`. `option` comes from `translatedScripturesOptions`? 
    // `Select` value is whole option object. `onChange` sets `setScripture(option?.value)`.
    // `ScripturesOptions` in `Data/Data.js` usually has English values "General Conference".
    // `translatedScripturesOptions` *labels* are translated, but *values* should ideally be stable constants.
    // Checking `NewNote.jsx`: 
    // `const translatedScripturesOptions = ScripturesOptions.map(option => ({ ...option, label: ... }))`
    // So value is likely English "General Conference".

    const scriptureName = scriptureMatch ? scriptureMatch[1].trim() : '';
    const chapterValue = chapterMatch ? chapterMatch[1].trim() : '';

    // Check if it's GC
    if (scriptureName === 'General Conference' || scriptureName === '総大会') {
        // If chapterValue is a clean URL, use the GC Renderer
        if (isGCUrl(chapterValue)) {
            const parts = {
                header: headerMatch[0].trim(),
                scriptureValue: scriptureName,
                chapterValueOriginal: chapterValue,
                comment: body.substring(chapterMatch.index + chapterMatch[0].length).trim()
            };
            return <GCNoteRenderer parts={parts} url={chapterValue} language={language} t={t} isSent={isSent} />;
        }
    }

    // Default formatting for non-GC or non-URL-GC notes
    // Use the existing format logic, but localized
    // We can reconstruct the string here using translations and render MD

    let headerTrans = headerMatch[0].trim();
    if (headerTrans.includes('New Study Note')) headerTrans = `📖 **${t('noteLabels.newStudyNote')}**`;
    if (headerTrans.includes('New Study Entry')) headerTrans = `📖 **${t('noteLabels.newStudyEntry')}**`;

    // Translate scripture name
    const translateScripture = (name) => {
        // Simple mapping based on your app's standard keys
        const map = {
            'Old Testament': 'scriptures.oldTestament',
            'New Testament': 'scriptures.newTestament',
            'Book of Mormon': 'scriptures.bookOfMormon',
            'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
            'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
            'General Conference': 'scriptures.generalConference',
            // Add legacy/other variants if needed
        };
        const key = map[name];
        return key ? t(key) : name;
    };

    const scripValTrans = translateScripture(scriptureName);

    // Translate Chapter/Label
    let chapLabel = t('noteLabels.chapter');
    if (body.includes('**Title:**')) chapLabel = t('noteLabels.title');
    if (body.includes('**Speech:**')) chapLabel = t('noteLabels.speech');
    if (scriptureName === 'General Conference' || scriptureName === '総大会') chapLabel = t('noteLabels.talk');

    // Translate Chapter Value (e.g. "Alma 7")
    const chapValTrans = translateChapterField(chapterValue, language);

    // Comment
    const commentLabel = t('noteLabels.comment');
    let comment = '';
    if (chapterMatch) {
        comment = body.substring(chapterMatch.index + chapterMatch[0].length).trim();
    } else if (scriptureMatch) {
        comment = body.substring(scriptureMatch.index + scriptureMatch[0].length).trim();
    } else {
        comment = body;
    }

    const constructedMd = `
${headerTrans}

**${t('noteLabels.scripture')}:** ${scripValTrans}

**${chapLabel}:** ${chapValTrans}

**${commentLabel}:**
${comment}
    `.trim();

    return (
        <ReactMarkdown
            components={{
                a: ({ node, ...props }) => (
                    <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: isSent ? 'white' : 'var(--purple)',
                            textDecoration: 'underline'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                )
            }}
        >
            {constructedMd}
        </ReactMarkdown>
    );

};

export default NoteDisplay;
