import { describe, it, expect } from 'vitest';
import { translateBookName, translateChapterField } from './bookNameTranslations';

describe('bookNameTranslations', () => {
    describe('translateBookName', () => {
        it('translates English book names to Japanese', () => {
            expect(translateBookName('1 Nephi', 'ja')).toBe('ニーファイ第一書');
            expect(translateBookName('Genesis', 'ja')).toBe('創世記');
            expect(translateBookName('Matthew', 'ja')).toBe('マタイによる福音書');
        });

        it('translates English book names to Portuguese', () => {
            expect(translateBookName('1 Nephi', 'pt')).toBe('1 Néfi');
            expect(translateBookName('Genesis', 'pt')).toBe('Gênesis');
        });

        it('handles case-insensitive English names', () => {
            expect(translateBookName('1 nephi', 'ja')).toBe('ニーファイ第一書');
            expect(translateBookName('genesis', 'ja')).toBe('創世記');
        });

        it('returns original name if translation is missing', () => {
            expect(translateBookName('Unknown Book', 'ja')).toBe('Unknown Book');
        });

        it('returns original name if language is not supported', () => {
            expect(translateBookName('1 Nephi', 'fr')).toBe('1 Nephi'); // Assuming 'fr' is not in map
        });
    });

    describe('translateChapterField', () => {
        it('translates book part of chapter reference (English -> Japanese)', () => {
            expect(translateChapterField('1 Nephi 3:7', 'ja')).toBe('ニーファイ第一書 3:7');
            expect(translateChapterField('Alma 7', 'ja')).toBe('アルマ書 7');
        });

        it('translates complex book names correctly', () => {
            expect(translateChapterField('Joseph Smith-History 1:15', 'ja')).toBe('ジョセフ・スミス—歴史 1:15');
            // Note: internal dict keys use hyphen for lookup but mapping uses em-dash?
            // Let's check code logic: bookName.replace(/—/g, '-'); for lookup
            // Dictionary key: "Joseph Smith-History" : "ジョセフ・スミス—歴史"
        });

        it('handles references without spaces before numbers if matched', () => {
            // Regex in code handles spaces or digits: (?:\s+|(?=\d))
            expect(translateChapterField('Alma7', 'ja')).toBe('アルマ書 7');
        });

        it('handles BYU Speeches URLs', () => {
            const url = 'https://speeches.byu.edu/talks/brad-wilcox/his-grace-is-sufficient/';
            expect(translateChapterField(url, 'en')).toBe('His Grace Is Sufficient (Brad Wilcox)');
        });

        it('handles General Conference URLs', () => {
            // Code returns simplified format
            const url = 'https://www.churchofjesuschrist.org/study/general-conference/2023/10/12nelson?lang=eng';
            expect(translateChapterField(url, 'en')).toBe('2023/10/12nelson');
        });
    });
});
