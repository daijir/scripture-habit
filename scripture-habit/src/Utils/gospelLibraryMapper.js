
export const getGospelLibraryUrl = (volume, chapterInput) => {
    if (!volume || !chapterInput) return null;

    const baseUrl = "https://www.churchofjesuschrist.org/study/scriptures";
    const lang = "?lang=eng";

    // Normalize volume to get the URL part
    let volumeUrlPart = "";
    switch (volume) {
        case "Old Testament": volumeUrlPart = "ot"; break;
        case "New Testament": volumeUrlPart = "nt"; break;
        case "Book of Mormon": volumeUrlPart = "bofm"; break;
        case "Doctrine and Convenants": // Handling the typo in Data.js if present, or standard
        case "Doctrine and Covenants": volumeUrlPart = "dc-testament"; break;
        case "Pearl of Great Price": volumeUrlPart = "pgp"; break;
        default: return null;
    }

    // Parse chapterInput to separate Book and Chapter
    // Logic: Look for the last number. Everything before it is the book, the number is the chapter.
    // Example: "1 Nephi 3" -> Book: "1 Nephi", Chapter: "3"
    // Example: "Alma 5" -> Book: "Alma", Chapter: "5"
    // Example: "D&C 4" -> Book: "D&C", Chapter: "4" (Special handling for D&C)

    // Regex to find the last number in the string, possibly followed by verses
    // Matches: "Alma 7", "Alma 7:11", "Alma 7:11-13", "138"
    // Group 1: Book name (e.g. "Alma" or "")
    // Group 2: Chapter number (e.g. "7")
    // Group 3: Verses (optional, e.g. ":11" or ":11-13")
    const match = chapterInput.match(/(.*?)\s*(\d+)(?::(\d+(?:-\d+)?))?\s*$/);

    if (!match) return null; // Could not find a chapter number

    let bookName = match[1].trim().toLowerCase().replace(/[.]/g, ''); // Remove dots, lowercase
    const chapterNum = match[2];
    const verses = match[3]; // This will be "11" or "11-13" if present

    let urlSuffix = lang;
    if (verses) {
        // If verses are present, add id and p parameters
        // Example: id=11-13&p11
        const firstVerse = verses.split('-')[0];
        urlSuffix += `&id=${verses}#p${firstVerse}`;
    }

    // Special handling for Doctrine and Covenants
    if (volumeUrlPart === "dc-testament") {
        // D&C usually just has section number, or "D&C [num]", "Section [num]"
        // The URL is always .../dc-testament/dc/[num]
        return `${baseUrl}/dc-testament/dc/${chapterNum}${urlSuffix}`;
    }

    // Mapping for other volumes
    const bookMappings = {
        // Book of Mormon
        "1 nephi": "1-ne", "1 ne": "1-ne",
        "2 nephi": "2-ne", "2 ne": "2-ne",
        "jacob": "jacob",
        "enos": "enos",
        "jarom": "jarom",
        "omni": "omni",
        "words of mormon": "w-of-m", "w of m": "w-of-m",
        "mosiah": "mosiah",
        "alma": "alma",
        "helaman": "hel", "hel": "hel",
        "3 nephi": "3-ne", "3 ne": "3-ne",
        "4 nephi": "4-ne", "4 ne": "4-ne",
        "mormon": "morm", "morm": "morm",
        "ether": "eth", "eth": "eth",
        "moroni": "moro", "moro": "moro",

        // Old Testament (Common ones)
        "genesis": "gen", "gen": "gen",
        "exodus": "ex", "ex": "ex",
        "leviticus": "lev", "lev": "lev",
        "numbers": "num", "num": "num",
        "deuteronomy": "deut", "deut": "deut",
        "joshua": "josh", "josh": "josh",
        "judges": "judg", "judg": "judg",
        "ruth": "ruth",
        "1 samuel": "1-sam", "1 sam": "1-sam",
        "2 samuel": "2-sam", "2 sam": "2-sam",
        "1 kings": "1-kgs", "1 kgs": "1-kgs",
        "2 kings": "2-kgs", "2 kgs": "2-kgs",
        "1 chronicles": "1-chr", "1 chr": "1-chr",
        "2 chronicles": "2-chr", "2 chr": "2-chr",
        "ezra": "ezra",
        "nehemiah": "neh", "neh": "neh",
        "esther": "esth", "esth": "esth",
        "job": "job",
        "psalms": "ps", "psalm": "ps", "ps": "ps",
        "proverbs": "prov", "prov": "prov",
        "ecclesiastes": "eccl", "eccl": "eccl",
        "song of solomon": "song", "song of songs": "song",
        "isaiah": "isa", "isa": "isa",
        "jeremiah": "jer", "jer": "jer",
        "lamentations": "lam", "lam": "lam",
        "ezekiel": "ezek", "ezek": "ezek",
        "daniel": "dan", "dan": "dan",
        "hosea": "hosea", "hos": "hos",
        "joel": "joel",
        "amos": "amos",
        "obadiah": "obad", "obad": "obad",
        "jonah": "jonah",
        "micah": "micah", "mic": "mic",
        "nahum": "nahum", "nah": "nah",
        "habakkuk": "hab", "hab": "hab",
        "zephaniah": "zeph", "zeph": "zeph",
        "haggai": "hag", "hag": "hag",
        "zechariah": "zech", "zech": "zech",
        "malachi": "mal", "mal": "mal",

        // New Testament
        "matthew": "matt", "matt": "matt",
        "mark": "mark",
        "luke": "luke",
        "john": "john",
        "acts": "acts",
        "romans": "rom", "rom": "rom",
        "1 corinthians": "1-cor", "1 cor": "1-cor",
        "2 corinthians": "2-cor", "2 cor": "2-cor",
        "galatians": "gal", "gal": "gal",
        "ephesians": "eph", "eph": "eph",
        "philippians": "philip", "phil": "philip",
        "colossians": "col", "col": "col",
        "1 thessalonians": "1-thes", "1 thes": "1-thes",
        "2 thessalonians": "2-thes", "2 thes": "2-thes",
        "1 timothy": "1-tim", "1 tim": "1-tim",
        "2 timothy": "2-tim", "2 tim": "2-tim",
        "titus": "titus", "tit": "titus",
        "philemon": "philem", "philem": "philem",
        "hebrews": "heb", "heb": "heb",
        "james": "jas", "jas": "jas",
        "1 peter": "1-pet", "1 pet": "1-pet",
        "2 peter": "2-pet", "2 pet": "2-pet",
        "1 john": "1-jn", "1 jn": "1-jn",
        "2 john": "2-jn", "2 jn": "2-jn",
        "3 john": "3-jn", "3 jn": "3-jn",
        "jude": "jude",
        "revelation": "rev", "rev": "rev",

        // Pearl of Great Price
        "moses": "moses",
        "abraham": "abr", "abr": "abr",
        "joseph smith matthew": "js-m", "js-m": "js-m", "joseph smith-matthew": "js-m",
        "joseph smith history": "js-h", "js-h": "js-h", "joseph smith-history": "js-h",
        "articles of faith": "a-of-f", "a of f": "a-of-f"
    };

    const bookUrlPart = bookMappings[bookName];

    if (!bookUrlPart) return null;

    return `${baseUrl}/${volumeUrlPart}/${bookUrlPart}/${chapterNum}${urlSuffix}`;
};

export const getScriptureInfoFromText = (text) => {
    if (!text) return null;
    const chapterMatch = text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
        const scripture = scriptureMatch[1].trim();
        const chapter = chapterMatch[1].trim();
        return getGospelLibraryUrl(scripture, chapter);
    }
    return null;
};
