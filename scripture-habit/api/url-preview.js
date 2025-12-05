// Vercel Serverless Function to fetch URL metadata for previews
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // Validate URL
        const parsedUrl = new URL(url);

        // Fetch the page
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ScriptureHabitBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(200).json({
                url,
                title: parsedUrl.hostname,
                description: null,
                image: null,
                favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`
            });
        }

        const html = await response.text();

        // Parse metadata
        const getMetaContent = (html, property) => {
            // Try Open Graph first
            const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
            if (ogMatch) return ogMatch[1];

            // Try Twitter cards
            const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`, 'i'));
            if (twitterMatch) return twitterMatch[1];

            // Try standard meta tags
            if (property === 'description') {
                const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
                if (descMatch) return descMatch[1];
            }

            return null;
        };

        // Get title
        let title = getMetaContent(html, 'title');
        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;
        }

        // Get description
        const description = getMetaContent(html, 'description');

        // Get image
        let image = getMetaContent(html, 'image');
        if (image && !image.startsWith('http')) {
            // Handle relative URLs
            image = new URL(image, url).href;
        }

        // Get favicon
        let favicon = null;
        const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
            html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
        if (faviconMatch) {
            favicon = faviconMatch[1];
            if (!favicon.startsWith('http')) {
                favicon = new URL(favicon, url).href;
            }
        } else {
            favicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;
        }

        // Decode HTML entities
        const decodeHtml = (text) => {
            if (!text) return text;
            return text
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&#x2F;/g, '/')
                .replace(/&nbsp;/g, ' ');
        };

        return res.status(200).json({
            url,
            title: decodeHtml(title) || parsedUrl.hostname,
            description: decodeHtml(description),
            image,
            favicon,
            siteName: parsedUrl.hostname
        });

    } catch (error) {
        console.error('Error fetching URL preview:', error.message);

        // Return basic info even on error
        try {
            const parsedUrl = new URL(url);
            return res.status(200).json({
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
