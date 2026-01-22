import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { url, lang } = req.query;
    console.log(`[Standalone Preview] Request URL: ${url}, Lang: ${lang}`);

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
    }

    const previewData = {
        url,
        title: '',
        description: null,
        image: null,
        favicon: null,
        siteName: ''
    };

    try {
        const parsedUrl = new URL(url);
        previewData.title = parsedUrl.hostname;
        previewData.siteName = parsedUrl.hostname;
        previewData.favicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;

        const isChurchUrl = parsedUrl.hostname.includes('churchofjesuschrist.org') || parsedUrl.hostname.includes('general-conference');

        console.log(`[Standalone Preview] Fetching: ${url}`);
        let response;
        try {
            const fetchUrl = new URL(url);
            if (lang && isChurchUrl) fetchUrl.searchParams.set('lang', lang);

            response = await axios.get(fetchUrl.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: 5000, // 5 seconds
                maxContentLength: 512 * 1024,
                validateStatus: () => true
            });
            console.log(`[Standalone Preview] Status: ${response?.status}`);
        } catch (fetchErr) {
            console.warn(`[Standalone Preview] Fetch error: ${fetchErr.message}`);
        }

        if (response && response.data && typeof response.data === 'string') {
            const $ = cheerio.load(response.data);

            // Title
            let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('h1').first().text().trim() ||
                $('title').text().trim();

            if (title) {
                if (title.includes(' | ')) title = title.split(' | ')[0];
                if (title.includes(' - ')) title = title.split(' - ')[0];
                previewData.title = title.trim();
            }

            // Speaker (Church sites)
            if (isChurchUrl) {
                const speaker = $('div.byline p.author-name').first().text().trim() ||
                    $('p.author-name').first().text().trim() ||
                    $('a.author-name').first().text().trim();
                if (speaker) {
                    const clean = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
                    if (!previewData.title.includes(clean)) {
                        previewData.title = `${previewData.title} (${clean})`;
                    }
                }
            }

            // Description
            previewData.description = $('meta[property="og:description"]').attr('content') ||
                $('meta[name="description"]').attr('content') || null;

            // Image
            let img = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
            if (img && typeof img === 'string') {
                if (!img.startsWith('http')) {
                    try { img = new URL(img, url).href; } catch (e) { }
                }
                previewData.image = img;
            }

            // Favicon
            let fav = $('link[rel="shortcut icon"]').attr('href') || $('link[rel="icon"]').attr('href');
            if (fav && typeof fav === 'string') {
                if (!fav.startsWith('http')) {
                    try { fav = new URL(fav, url).href; } catch (e) { }
                }
                previewData.favicon = fav;
            }

            previewData.siteName = $('meta[property="og:site_name"]').attr('content') ||
                (isChurchUrl ? 'Church of Jesus Christ' : parsedUrl.hostname);
        }

        return res.status(200).json(previewData);

    } catch (error) {
        console.error(`[Standalone Preview] Catch-all error:`, error.message);
        return res.status(200).json(previewData); // Always return JSON
    }
}
