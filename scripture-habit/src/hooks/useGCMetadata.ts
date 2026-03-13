import { useState, useEffect } from 'react';
import { safeStorage } from '../Utils/storage';
import type { Language } from '../Context/LanguageContext';

export interface GCMetadata {
    title: string;
    speaker: string;
}

interface useGCMetadataResult {
    data: GCMetadata | null;
    loading: boolean;
    error: Error | null;
}

// Cache in memory as well to avoid reading localStorage constantly for the same session
const memoryCache: Record<string, GCMetadata> = {};

export const useGCMetadata = (urlOrSlug: string | null | undefined, language: Language | string): useGCMetadataResult => {
    const [data, setData] = useState<GCMetadata | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!urlOrSlug || !language) return;

        // Determine if it is a fetchable GC item
        const isUrlStr = urlOrSlug.startsWith('http');
        const isChurchUrl = urlOrSlug.includes('churchofjesuschrist.org') || urlOrSlug.includes('general-conference');

        if (!isUrlStr) {
            return;
        }

        // Construct a unique cache key
        const cacheKey = `gc_meta_${language}_${urlOrSlug}`;

        // 1. Check Memory Cache
        if (memoryCache[cacheKey]) {
            setData(memoryCache[cacheKey]);
            return;
        }

        // 2. Check LocalStorage
        const localCached = safeStorage.get(cacheKey);
        if (localCached) {
            try {
                const parsed = JSON.parse(localCached) as GCMetadata;
                memoryCache[cacheKey] = parsed;
                setData(parsed);
                return;
            } catch (e) {
                console.error("Error parsing cached GC metadata", e);
            }
        }

        // 3. Fetch from API
        const fetchMetadata = async () => {
            setLoading(true);
            try {
                // Determine the URL to fetch
                let fetchUrl = urlOrSlug;

                if (!fetchUrl.startsWith('http')) {
                    fetchUrl = `https://www.churchofjesuschrist.org${fetchUrl.startsWith('/') ? '' : '/'}${fetchUrl}`;
                }

                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';
                
                const langMap: Record<string, string> = {
                    'en': 'eng',
                    'ja': 'jpn',
                    'pt': 'por',
                    'es': 'spa',
                    'zho': 'zho',
                    'vi': 'vie',
                    'th': 'tha',
                    'ko': 'kor',
                    'tl': 'tgl',
                    'sw': 'swa'
                };

                const apiLang = langMap[language] || 'eng';

                const endpoint = isChurchUrl ? '/api/fetch-gc-metadata' : '/api/url-preview';
                const finalApiUrl = `${API_BASE}${endpoint}?url=${encodeURIComponent(fetchUrl)}&lang=${apiLang}`;

                const response = await fetch(finalApiUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch metadata');
                }

                const result = await response.json();

                // Update Cache
                const meta: GCMetadata = {
                    title: result.title || '',
                    speaker: result.speaker || ''
                };

                safeStorage.set(cacheKey, JSON.stringify(meta));
                memoryCache[cacheKey] = meta;

                setData(meta);
            } catch (err: any) {
                console.error("Error fetching metadata:", err);
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();

    }, [urlOrSlug, language]);

    return { data, loading, error };
};
