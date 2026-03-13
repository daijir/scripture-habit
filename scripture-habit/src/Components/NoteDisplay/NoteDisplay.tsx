import { useMemo, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../Context/LanguageContext';
import { useGCMetadata } from '../../hooks/useGCMetadata';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../Utils/noteUtils';
import LinkPreview from '../LinkPreview/LinkPreview';

/**
 * Checks if a string is a URL or a GC-style shortcode.
 */
const isGCUrl = (str: string | undefined): boolean => {
    if (!str) return false;
    const clean = str.trim();
    if (clean.toLowerCase().startsWith('http')) return true;
    return /^\d{4}\/\d{2}\/.+$/.test(clean);
};

const extractUrls = (text: string | undefined): string[] => {
    if (!text) return [];
    const urlPattern = /https?:\/\/[^\s"']+/gi;
    const matches = text.match(urlPattern);
    if (!matches) return [];

    const seen = new Set<string>();
    return matches.map(url => url.replace(/[.,:;"')\]]+$/, '')).filter(url => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
};

// Map scripture names to translation keys
const translateScriptureName = (name: string, t: (key: string) => string): string => {
    if (!name) return '';
    const map: Record<string, string> = {
        'Old Testament': 'scriptures.oldTestament',
        'New Testament': 'scriptures.newTestament',
        'Book of Mormon': 'scriptures.bookOfMormon',
        'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
        'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
        'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
        'General Conference': 'scriptures.generalConference',
        'BYU Speeches': 'scriptures.byuSpeeches',
        'Other': 'scriptures.other',
        'その他': 'scriptures.other'
    };
    const key = map[name];
    return key ? t(key) : name;
};

/**
 * Renders rich content (Titles, Labels)
 */
interface GCNoteRendererProps {
    scriptureValue: string;
    comment: string;
    url: string;
    language: string;
    t: (key: string) => string;
    isSent: boolean;
    linkColor?: string;
    translatedText?: string;
}

const GCNoteRenderer: FC<GCNoteRendererProps> = ({ scriptureValue, comment, url, language, t, isSent, linkColor, translatedText }) => {
    const { data, loading } = useGCMetadata(url, language);

    const scripLower = (scriptureValue || '').toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
    const isBYU = scripLower.includes('byu');

    const constructedMd = useMemo(() => {
        const headerLabel = t('noteLabels.newStudyNote');
        const headerLine = `📖 **${headerLabel}**`;

        const scriptureLabel = t('noteLabels.scripture');
        const scriptName = translateScriptureName(scriptureValue, t);

        let fieldLabel = t('noteLabels.talk');
        if (isOther) fieldLabel = t('noteLabels.title');
        else if (isBYU) fieldLabel = t('noteLabels.speech');

        let fieldValue = url;
        if (loading) {
            fieldValue = `_${t('noteLabels.fetchingInfo') || 'Loading info...'}_`;
        } else if (data && data.title) {
            fieldValue = (data.speaker && !isOther) ? `${data.title} (${data.speaker})` : data.title;
        }

        const commentLabel = t('noteLabels.comment');
        // Clean comment: remove lines that are just '**' and strip leading/trailing '**'
        const cleanComment = (comment || '')
            .split('\n')
            .filter(line => line.trim() !== '**')
            .join('\n')
            .replace(/^\s*\*\*\s*/, '')
            .replace(/\s*\*\*\s*$/, '')
            .trim();
        const commentWithLinks = cleanComment.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)');

        // Use double newlines to ensure line breaks in all Markdown renderers
        const lines = [
            headerLine,
            `**${scriptureLabel}:** ${scriptName}`,
            `**${fieldLabel}:** ${fieldValue}`
        ];

        return lines.join('\n') + `\n**${commentLabel}:**\n${commentWithLinks}`;

    }, [data, loading, scriptureValue, comment, t, url, isOther, isBYU]);

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                a: ({node, ...p}) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()} />,
                p: ({node, ...p}) => <p {...p} style={{ margin: '0.6rem 0', lineHeight: '1.5' }} />
            }}>
                {constructedMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.8rem', borderTop: '1px dashed #ccc', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: ({node, ...p}) => <p {...p} style={{ margin: '0.3rem 0' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

interface NoteDisplayProps {
    text: string;
    isSent: boolean;
    linkColor?: string;
    translatedText?: string;
}

const NoteDisplay: FC<NoteDisplayProps> = ({ text, isSent, linkColor, translatedText }) => {
    const { language, t } = useLanguage();

    // 1. Structure Check
    const headerMatch = text.match(NOTE_HEADER_REGEX);
    const hasCategoryLabel = text.includes('カテゴリ:') || text.includes('カテゴリ：') || text.includes('Scripture:') || text.includes('Category:');

    if (!headerMatch && !hasCategoryLabel) {
        const simpleUrls = extractUrls(text);
        const processedText = (text || '').replace(/(\]\()?https?:\/\/[^\s]+/g, (match, p1) => {
            if (p1) return match;
            return `[${match}](${match})`;
        });
        return (
            <div style={{ textAlign: 'left' }}>
                <ReactMarkdown components={{
                    a: ({node, ...p}) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={e => e.stopPropagation()} />,
                    p: ({node, ...p}) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} />
                }}>
                    {processedText}
                </ReactMarkdown>
                {translatedText && (
                    <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #ccc', paddingTop: '0.4rem' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                        <ReactMarkdown components={{ p: ({node, ...p}) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} /> }}>{translatedText}</ReactMarkdown>
                    </div>
                )}
                {simpleUrls.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>{simpleUrls.map((u, i) => <LinkPreview key={i} url={u} isSent={isSent} language={language || 'en'} t={t} />)}</div>
                )}
            </div>
        );
    }

    // 2. Parse Structured Note
    const contentBody = headerMatch ? removeNoteHeader(text) : text;
    // Split by newlines initially
    const initialLines = contentBody.split('\n');
    const lines: string[] = [];

    // Further split lines if they contain multiple labels on the same line
    const labelMarkers = ['カテゴリ:', 'カテゴリ：', '章:', '章：', 'Title:', 'Title：', 'Url:', 'Url：', 'Comment:', 'Comment：', 'コメント:', 'コメント：'];

    initialLines.forEach(line => {
        const currentLine = line;
        // Check for subsequent labels on the same line
        const foundPos: { pos: number; marker: string }[] = [];
        labelMarkers.forEach(marker => {
            const pos = currentLine.indexOf(marker);
            // Ignore if it's at the very beginning (already handled by split)
            if (pos > 5) {
                foundPos.push({ pos, marker });
            }
        });

        if (foundPos.length > 0) {
            // Sort by position
            foundPos.sort((a, b) => a.pos - b.pos);
            let lastIdx = 0;
            foundPos.forEach(fp => {
                lines.push(currentLine.substring(lastIdx, fp.pos).trim());
                lastIdx = fp.pos;
            });
            lines.push(currentLine.substring(lastIdx).trim());
        } else {
            lines.push(line);
        }
    });

    let scriptureValue = '';
    let chapterValue = '';
    const commentLines: string[] = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const dividerIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');

        if (dividerIndex !== -1 && dividerIndex < 60) {
            const labelRaw = trimmed.substring(0, dividerIndex).replace(/\*/g, '').trim().toLowerCase();
            const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();

            if (labelRaw.includes('scripture') || labelRaw.includes('カテゴリ')) {
                scriptureValue = value;
            } else if (
                labelRaw.includes('chapter') || labelRaw.includes('url') || labelRaw.includes('title') ||
                labelRaw.includes('章') || labelRaw.includes('リンク') || labelRaw.includes('speech') ||
                labelRaw.includes('talk') || labelRaw.includes('スピーチ') || labelRaw.includes('お話')
            ) {
                // If chapterValue is already a URL, don't overwrite it with a Talk/Speech title
                const valIsUrl = isGCUrl(value);
                const currentIsUrl = isGCUrl(chapterValue);
                if (!chapterValue || valIsUrl || !currentIsUrl) {
                    chapterValue = value;
                }
            } else if (labelRaw.includes('comment') || labelRaw.includes('コメント')) {
                if (value) commentLines.push(value);
            } else {
                commentLines.push(trimmed);
            }
        } else {
            commentLines.push(trimmed);
        }
    });

    // Clean comment: remove lines that are just '**' and strip leading/trailing '**'
    const commentRaw = commentLines.join('\n').trim();
    const comment = commentRaw
        .split('\n')
        .filter(line => line.trim() !== '**')
        .join('\n')
        .replace(/^\s*\*\*\s*/, '')
        .replace(/\s*\*\*\s*$/, '')
        .trim();

    const allUrls = extractUrls(text);
    const primaryUrl = isGCUrl(chapterValue) ? chapterValue : (allUrls[0] || null);

    const scripLower = (scriptureValue || '').toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
    const isGC = scripLower.includes('general') || scripLower.includes('総大会');
    const isBYU = scripLower.includes('byu');

    if (primaryUrl && (isGC || isOther || isBYU)) {
        return (
            <GCNoteRenderer
                scriptureValue={scriptureValue}
                comment={comment}
                url={primaryUrl}
                language={language} t={t} isSent={isSent} linkColor={linkColor} translatedText={translatedText}
            />
        );
    }

    const headerLabel = t('noteLabels.newStudyNote');
    const scriptureNameTrans = translateScriptureName(scriptureValue, t);
    let chapLabel = t('noteLabels.chapter');
    if (isOther) chapLabel = t('noteLabels.title');
    else if (isBYU) chapLabel = t('noteLabels.speech');
    else if (isGC) chapLabel = t('noteLabels.talk');

    // Use double newlines for consistent spacing
    const topLines = [
        `📖 **${headerLabel}**`,
        `**${t('noteLabels.scripture')}:** ${scriptureNameTrans}`,
        (translateChapterField(chapterValue, language) || chapterValue) ? `**${chapLabel}:** ${translateChapterField(chapterValue, language) || chapterValue}` : null
    ].filter(Boolean);

    const finalMd = topLines.join('\n') + `\n\n**${t('noteLabels.comment')}:**\n${comment.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)')}`;

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                a: ({node, ...p}) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={e => e.stopPropagation()} />,
                p: ({node, ...p}) => <p {...p} style={{ margin: '0.4rem 0', whiteSpace: 'pre-wrap' }} />
            }}>
                {finalMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.6rem', borderTop: '1px dashed #ccc', paddingTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: ({node, ...p}) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

export default NoteDisplay;
