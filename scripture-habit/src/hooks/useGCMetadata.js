import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Cache in memory as well to avoid reading localStorage constantly for the same session
const memoryCache = {};

export const useGCMetadata = (urlOrSlug, language) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!urlOrSlug || !language) return;

        // Determine if it is a fetchable GC item
        // It must look like a URL or a specific slug structure
        // If it's just "Alma 7", we don't fetch.
        // We look for "churchofjesuschrist.org" or "general-conference"
        const isUrl = urlOrSlug.includes('churchofjesuschrist.org') || urlOrSlug.includes('general-conference');

        if (!isUrl) {
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
        const localCached = localStorage.getItem(cacheKey);
        if (localCached) {
            try {
                const parsed = JSON.parse(localCached);
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

                // If it's a partial path (e.g. /study/general-conference...), prepend domain?
                // The API expects a full URL usually, or we can handle it.
                // If the user pasted a relative path, we might need to fix it.
                if (!fetchUrl.startsWith('http')) {
                    fetchUrl = `https://www.churchofjesuschrist.org${fetchUrl.startsWith('/') ? '' : '/'}${fetchUrl}`;
                }

                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';
                // Logic for mapping languages to Church website language codes

                const langMap = {
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

                // Override target lang if mapped
                let apiLang = langMap[language] || 'eng';
                // For Chinese, Church often uses ?lang=zho for Traditional.

                const finalApiUrl = `${API_BASE}/api/fetch-gc-metadata?url=${encodeURIComponent(fetchUrl)}&lang=${apiLang}`;

                const response = await fetch(finalApiUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch metadata');
                }

                const result = await response.json();

                // Update Cache
                const meta = { title: result.title, speaker: result.speaker };
                localStorage.setItem(cacheKey, JSON.stringify(meta));
                memoryCache[cacheKey] = meta;

                setData(meta);
            } catch (err) {
                console.error("Error fetching GC metadata:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();

    }, [urlOrSlug, language]);

    return { data, loading, error };
};
