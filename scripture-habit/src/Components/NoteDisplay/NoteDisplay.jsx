import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../Context/LanguageContext';
import { useGCMetadata } from '../../hooks/useGCMetadata';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../Utils/noteUtils';
import LinkPreview from '../LinkPreview/LinkPreview';

/**
 * Checks if a string is a URL or a GC-style shortcode.
 */
const isGCUrl = (str) => {
    if (!str) return false;
    const clean = str.trim();
    if (clean.toLowerCase().startsWith('http')) return true;
    return /^\d{4}\/\d{2}\/.+$/.test(clean);
};

const extractUrls = (text) => {
    if (!text) return [];
    const urlPattern = /https?:\/\/[^\s"']+/gi;
    const matches = text.match(urlPattern);
    if (!matches) return [];

    const seen = new Set();
    return matches.map(url => url.replace(/[.,:;"')\]]+$/, '')).filter(url => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
};

// Map scripture names to translation keys
const translateScriptureName = (name, t) => {
    if (!name) return '';
    const map = {
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
const GCNoteRenderer = ({ header, scriptureValue, chapterValue, comment, url, language, t, isSent, linkColor, translatedText }) => {
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
        return [
            headerLine,
            `**${scriptureLabel}:** ${scriptName}`,
            `**${fieldLabel}:** ${fieldValue}`,
            `**${commentLabel}:**\n${commentWithLinks}`
        ].join('\n\n').trim();

    }, [data, loading, header, scriptureValue, comment, t, url, isOther, isBYU]);

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                a: p => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()} />,
                p: p => <p {...p} style={{ margin: '0.6rem 0', lineHeight: '1.5' }} />
            }}>
                {constructedMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.8rem', borderTop: '1px dashed #ccc', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: p => <p {...p} style={{ margin: '0.3rem 0' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

const NoteDisplay = ({ text, isSent, linkColor, translatedText }) => {
    const { language, t } = useLanguage();

    // 1. Structure Check
    const headerMatch = text.match(NOTE_HEADER_REGEX);
    const hasCategoryLabel = text.includes('カテゴリ:') || text.includes('カテゴリ：') || text.includes('Scripture:') || text.includes('Category:');

    if (!headerMatch && !hasCategoryLabel) {
        const simpleUrls = extractUrls(text);
        const processedText = (text || '').replace(/(?<!\]\()https?:\/\/[^\s]+/g, '[$&]($&)');
        return (
            <div style={{ textAlign: 'left' }}>
                <ReactMarkdown components={{
                    a: p => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={e => e.stopPropagation()} />,
                    p: p => <p {...p} style={{ margin: '0.4rem 0', whiteSpace: 'pre-wrap' }} />
                }}>
                    {processedText}
                </ReactMarkdown>
                {translatedText && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                        <ReactMarkdown components={{ p: p => <p {...p} style={{ margin: '0.3rem 0', whiteSpace: 'pre-wrap' }} /> }}>{translatedText}</ReactMarkdown>
                    </div>
                )}
                {simpleUrls.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>{simpleUrls.map((u, i) => <LinkPreview key={i} url={u} isSent={isSent} language={language} t={t} />)}</div>
                )}
            </div>
        );
    }

    // 2. Parse Structured Note
    const contentBody = headerMatch ? removeNoteHeader(text) : text;
    // Split by newlines initially
    let initialLines = contentBody.split('\n');
    let lines = [];

    // Further split lines if they contain multiple labels on the same line
    const labelMarkers = ['カテゴリ:', 'カテゴリ：', '章:', '章：', 'Title:', 'Title：', 'Url:', 'Url：', 'Comment:', 'Comment：', 'コメント:', 'コメント：'];

    initialLines.forEach(line => {
        let currentLine = line;
        // Check for subsequent labels on the same line
        let foundPos = [];
        labelMarkers.forEach(marker => {
            let pos = currentLine.indexOf(marker);
            // Ignore if it's at the very beginning (already handled by split)
            if (pos > 5) {
                foundPos.push({ pos, marker });
            }
        });

        if (foundPos.length > 0) {
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
    let commentLines = [];

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
                chapterValue = value;
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
                header={headerMatch ? headerMatch[0].trim() : ''}
                scriptureValue={scriptureValue}
                chapterValue={chapterValue}
                comment={comment}
                url={primaryUrl}
                language={language} t={t} isSent={isSent} linkColor={linkColor} translatedText={translatedText}
            />
        );
    }

    const headerLabel = t('noteLabels.newStudyNote');
    const scriptureNameTrans = translateScriptureName(scriptureValue, t);
    let chapLabel = isOther ? t('noteLabels.title') : (isBYU ? t('noteLabels.speech') : t('noteLabels.chapter'));

    // Use double newlines for consistent spacing
    const finalMd = [
        `📖 **${headerLabel}**`,
        `**${t('noteLabels.scripture')}:** ${scriptureNameTrans}`,
        (translateChapterField(chapterValue, language) || chapterValue) ? `**${chapLabel}:** ${translateChapterField(chapterValue, language) || chapterValue}` : null,
        `**${t('noteLabels.comment')}:**\n${comment.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)')}`
    ].filter(Boolean).join('\n\n').trim();

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                p: p => <p {...p} style={{ margin: '0.6rem 0', lineHeight: '1.5' }} />,
                a: p => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'underline' }} onClick={e => e.stopPropagation()} />
            }}>
                {finalMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.8rem', borderTop: '1px dashed #ccc', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: p => <p {...p} style={{ margin: '0.3rem 0' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

export default NoteDisplay;
