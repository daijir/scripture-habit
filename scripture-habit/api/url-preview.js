const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { url, lang } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const parsedUrl = new URL(url);
        const isChurchUrl = parsedUrl.hostname.includes('churchofjesuschrist.org') || parsedUrl.hostname.includes('general-conference');

        if (lang && isChurchUrl) {
            parsedUrl.searchParams.set('lang', lang);
        }

        const fetchUrl = parsedUrl.toString();

        const response = await axios.get(fetchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': lang === 'ja' ? 'ja,en-US;q=0.7,en;q=0.3' : 'en-US,en;q=0.5',
            },
            timeout: 8000
        });

        const $ = cheerio.load(response.data);

        // 1. Specialized Title Extraction for Church URLs
        let title = '';
        if (isChurchUrl) {
            title = $('meta[property="og:title"]').attr('content') ||
                $('h1').first().text().trim() ||
                $('title').text().trim();

            // Further clean Church titles
            if (title.includes(' | ')) title = title.split(' | ')[0];
        } else {
            title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text().trim() ||
                $('h1').first().text().trim();
        }

        // 2. Specialized Speaker Extraction for Church URLs
        let speaker = '';
        if (isChurchUrl) {
            speaker = $('div.byline p.author-name').first().text().trim() ||
                $('p.author-name').first().text().trim() ||
                $('a.author-name').first().text().trim();

            if (speaker) {
                speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
            }
        }

        // Combine title and speaker if available
        let displayTitle = title;
        if (speaker && displayTitle && !displayTitle.includes(speaker)) {
            displayTitle = `${title} (${speaker})`;
        }

        const description = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            null;

        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content');
        if (image && !image.startsWith('http')) {
            image = new URL(image, url).href;
        }

        const siteName = $('meta[property="og:site_name"]').attr('content') ||
            (isChurchUrl ? 'Church of Jesus Christ' : parsedUrl.hostname);

        let favicon = $('link[rel="shortcut icon"]').attr('href') ||
            $('link[rel="icon"]').attr('href') ||
            `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;

        if (favicon && !favicon.startsWith('http')) {
            favicon = new URL(favicon, url).href;
        }

        return res.status(200).json({
            url,
            title: displayTitle ? displayTitle.trim() : parsedUrl.hostname,
            description: description ? description.trim() : null,
            image,
            favicon,
            siteName: siteName
        });

    } catch (error) {
        console.error('Error fetching URL preview:', error.message);
        try {
            const parsedUrl = new URL(url);
            return res.json({
                url,
                title: parsedUrl.hostname,
                description: null,
                image: null,
                favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
                siteName: parsedUrl.hostname
            });
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }
    }
}
