import { describe, it, expect } from 'vitest';
import { getGospelLibraryUrl } from './gospelLibraryMapper';

describe('getGospelLibraryUrl', () => {
    describe('Book of Mormon', () => {
        it('should generate correct URL for English', () => {
            const result = getGospelLibraryUrl('Book of Mormon', '1 Nephi 3:7', 'en');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=7#p7');
        });

        it('should generate correct URL for Japanese', () => {
            const result = getGospelLibraryUrl('モルモン書', 'ニーファイ第一書 3章7節', 'ja');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=7#p7');
        });

        it('should handle variations in input format', () => {
            const result = getGospelLibraryUrl('Book of Mormon', '1 ne 3:7-8', 'en');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=7-8#p7');
        });
    });

    describe('Doctrine and Covenants', () => {
        it('should generate correct URL', () => {
            const result = getGospelLibraryUrl('Doctrine and Covenants', '89', 'en');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=eng');
        });

        it('should generate correct URL for Japanese', () => {
            const result = getGospelLibraryUrl('教義と聖約', '89', 'ja');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=jpn');
        });
    });

    describe('General Conference', () => {
        it('should handle full URL input', () => {
            const url = "https://www.churchofjesuschrist.org/study/general-conference/2023/10/14nelson?lang=eng";
            const result = getGospelLibraryUrl('General Conference', url, 'ja');
            expect(result).toBe("https://www.churchofjesuschrist.org/study/general-conference/2023/10/14nelson?lang=jpn");
        });

        it('should handle YYYY/MM/slug format', () => {
            const input = "2023/10/14nelson";
            const result = getGospelLibraryUrl('General Conference', input, 'en');
            expect(result).toBe("https://www.churchofjesuschrist.org/study/general-conference/2023/10/14nelson?lang=eng");
        });
    });

    describe('Edge Cases', () => {
        it('should return null for invalid inputs', () => {
            expect(getGospelLibraryUrl(null, 'foo')).toBeNull();
            expect(getGospelLibraryUrl('foo', null)).toBeNull();
            expect(getGospelLibraryUrl('Unknown Book', '1:1')).toBeNull();
        });

        it('should handle full-width characters', () => {
            // １８章１１ -> 18:11
            const result = getGospelLibraryUrl('モルモン書', 'ニーファイ第一書 ３章７節', 'ja');
            expect(result).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=7#p7');
        });
    });
});
