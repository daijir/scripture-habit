/**
 * Fetch Bulk General Conference Talk Titles (Japanese)
 * 2016 - 2025
 * 
 * Usage: 
 * node tools/fetch-gc-bulk-jp.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const startYear = 2016;
const endYear = 2025;
const months = ['04', '10'];
const lang = 'jpn';

const baseUrl = 'https://www.churchofjesuschrist.org/study/general-conference';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchSession(year, month) {
    const url = `${baseUrl}/${year}/${month}?lang=${lang}`;
    // console.log(`Fetching ${year}/${month}...`); // Only log errors or completion per session to keep output clean

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const mappings = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const match = href.match(new RegExp(`/study/general-conference/${year}/${month}/([^?#]+)`));

            if (match) {
                const slug = match[1];

                // Try finding Hebrew/Japanese specific classes or generic ones
                let title = $(el).find('span.title').text().trim();

                if (!title) {
                    let h4 = $(el).find('h4');
                    if (h4.length) title = h4.text().trim();
                }

                if (!title) {
                    title = $(el).text().trim();
                }

                if (title && slug && !['Watch', 'Share', 'Download', '視聴', 'シェア', 'ダウンロード'].includes(title)) {
                    title = title.replace(/\s+/g, ' ').trim();
                    title = title.replace(/"/g, '\\"');
                    mappings.push(`    "${year}/${month}/${slug}": "${title}",`);
                }
            }
        });

        return mappings;

    } catch (error) {
        console.error(`Error fetching ${year}/${month}:`, error.message);
        return [];
    }
}

async function run() {
    console.log('// --- Japanese General Conference Titles (2016-2025) ---');
    console.log('export const talkTitlesJa = {');

    // Iterate backwards from 2025 to 2016 to match the file's usual order
    for (let y = endYear; y >= startYear; y--) {
        // Oct then Apr
        for (let mIndex = months.length - 1; mIndex >= 0; mIndex--) {
            const m = months[mIndex];

            // Skip future sessions if needed (e.g. 2025/10 might not exist yet if run early 2025)
            // But user requested 2025, assuming data exists or will return empty gracefully.

            const lines = await fetchSession(y, m);
            if (lines.length > 0) {
                console.log(`\n    // --- ${y}/${m} ---`);
                // Use a Set to remove duplicates within the session
                [...new Set(lines)].forEach(line => console.log(line));

                // Be polite to the server
                await delay(500);
            }
        }
    }
    console.log('};');
}

run();
