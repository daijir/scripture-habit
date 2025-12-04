
export const getGospelLibraryUrl = (volume, chapterInput, language = 'en') => {
    if (!volume || !chapterInput) return null;

    const baseUrl = "https://www.churchofjesuschrist.org/study/scriptures";
    // Determine language parameter
    // For Vietnamese, OT and NT default to English (?lang=eng), others use ?lang=vie
    let langParam = "?lang=eng";
    if (language === 'ja') langParam = "?lang=jpn";
    else if (language === 'pt') langParam = "?lang=por";
    else if (language === 'zho') langParam = "?lang=zho";
    else if (language === 'es') langParam = "?lang=spa";
    else if (language === 'vi') langParam = "?lang=vie";

    // Normalize volume to get the URL part
    let volumeUrlPart = "";
    const lowerVolume = volume.toLowerCase();

    if (lowerVolume === "old testament" || volume === "旧約聖書" || volume === "Velho Testamento" || volume === "舊約" || volume === "Antiguo Testamento" || volume === "Cựu Ước") {
        volumeUrlPart = "ot";
        // Vietnamese fallback for OT
        if (language === 'vi') langParam = "?lang=eng";
    } else if (lowerVolume === "new testament" || volume === "新約聖書" || volume === "Novo Testamento" || volume === "新約" || volume === "Nuevo Testamento" || volume === "Tân Ước") {
        volumeUrlPart = "nt";
        // Vietnamese fallback for NT
        if (language === 'vi') langParam = "?lang=eng";
    } else if (lowerVolume === "book of mormon" || volume === "モルモン書" || volume === "O Livro de Mórmon" || volume === "摩爾門經" || volume === "El Libro de Mormón" || volume === "Sách Mặc Môn") {
        volumeUrlPart = "bofm";
    } else if (lowerVolume.includes("doctrine and") || volume === "教義と聖約" || volume === "Doutrina e Convênios" || volume === "教義和聖約" || volume === "Doctrina y Convenios" || volume === "Giáo Lý và Giao Ước") {
        // Covers "Doctrine and Covenants", "Doctrine and Convenants" (typo), and Japanese/Portuguese/Chinese/Spanish/Vietnamese
        volumeUrlPart = "dc-testament";
    } else if (lowerVolume === "pearl of great price" || volume === "高価な真珠" || volume === "Pérola de Grande Valor" || volume === "無價珍珠" || volume === "La Perla de Gran Precio" || volume === "Trân Châu Vô Giá") {
        volumeUrlPart = "pgp";
    } else {
        return null;
    }

    // Parse chapterInput to separate Book and Chapter
    // Remove "章" (chapter) for Japanese inputs to handle "ニーファイ第一書 3章"
    const cleanChapterInput = chapterInput.replace(/章/g, '');

    // Regex to find the last number in the string, possibly followed by verses
    // Matches: "Alma 7", "Alma 7:11", "Alma 7:11-13", "138", "ニーファイ第一書 3"
    // Group 1: Book name (e.g. "Alma" or "")
    // Group 2: Chapter number (e.g. "7")
    // Group 3: Verses (optional, e.g. ":11" or ":11-13")
    const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::(\d+(?:-\d+)?))?\s*$/);

    if (!match) return null; // Could not find a chapter number

    let bookName = match[1].trim().toLowerCase().replace(/[.]/g, ''); // Remove dots, lowercase
    const chapterNum = match[2];
    const verses = match[3]; // This will be "11" or "11-13" if present

    let urlSuffix = langParam;
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

        // Japanese Book of Mormon
        "ニーファイ第一書": "1-ne", "ニーファイ第一": "1-ne", "1ニーファイ": "1-ne",
        "ニーファイ第二書": "2-ne", "ニーファイ第二": "2-ne", "2ニーファイ": "2-ne",
        "ヤコブ書": "jacob", "ヤコブ": "jacob",
        "エノス書": "enos", "エノス": "enos",
        "ヤロム書": "jarom", "ヤロム": "jarom",
        "オムナイ書": "omni", "オムナイ": "omni",
        "モルモンの言葉": "w-of-m",
        "モーサヤ書": "mosiah", "モーサヤ": "mosiah",
        "アルマ書": "alma", "アルマ": "alma",
        "ヘラマン書": "hel", "ヘラマン": "hel",
        "ニーファイ第三書": "3-ne", "ニーファイ第三": "3-ne", "3ニーファイ": "3-ne",
        "ニーファイ第四書": "4-ne", "ニーファイ第四": "4-ne", "4ニーファイ": "4-ne",
        "モルモン書": "morm", "モルモン": "morm",
        "エテル書": "eth", "エテル": "eth",
        "モロナイ書": "moro", "モロナイ": "moro",

        // Portuguese Book of Mormon
        "1 néfi": "1-ne", "1 nefi": "1-ne", "1 ne": "1-ne",
        "2 néfi": "2-ne", "2 nefi": "2-ne", "2 ne": "2-ne",
        "jacó": "jacob", "jaco": "jacob",
        "enos": "enos",
        "jarom": "jarom",
        "ômni": "omni", "omni": "omni",
        "palavras de mórmon": "w-of-m", "palavras de mormon": "w-of-m",
        "mosias": "mosiah",
        "alma": "alma",
        "helamã": "hel", "helama": "hel",
        "3 néfi": "3-ne", "3 nefi": "3-ne", "3 ne": "3-ne",
        "4 néfi": "4-ne", "4 nefi": "4-ne", "4 ne": "4-ne",
        "mórmon": "morm", "mormon": "morm",
        "éter": "eth", "eter": "eth",
        "morôni": "moro", "moroni": "moro",

        // Traditional Chinese Book of Mormon
        "尼腓一書": "1-ne", "1尼腓": "1-ne",
        "尼腓二書": "2-ne", "2尼腓": "2-ne",
        "雅各書": "jacob",
        "以挪士書": "enos",
        "雅龍書": "jarom",
        "奧姆奈書": "omni",
        "摩爾門語": "w-of-m",
        "摩賽亞書": "mosiah",
        "阿爾瑪書": "alma",
        "希拉曼書": "hel",
        "尼腓三書": "3-ne", "3尼腓": "3-ne",
        "尼腓四書": "4-ne", "4尼腓": "4-ne",
        "摩爾門書": "morm",
        "以帖書": "eth",
        "摩羅乃書": "moro",

        // Spanish Book of Mormon
        "1 nefi": "1-ne", "1 ne": "1-ne",
        "2 nefi": "2-ne", "2 ne": "2-ne",
        "jacob": "jacob",
        "enos": "enos",
        "jarom": "jarom",
        "omni": "omni",
        "palabras de mormon": "w-of-m",
        "mosiah": "mosiah",
        "alma": "alma",
        "helaman": "hel",
        "3 nefi": "3-ne", "3 ne": "3-ne",
        "4 nefi": "4-ne", "4 ne": "4-ne",
        "mormon": "morm",
        "eter": "eth",
        "moroni": "moro",

        // Vietnamese Book of Mormon
        "1 nê phi": "1-ne", "1 ne phi": "1-ne",
        "2 nê phi": "2-ne", "2 ne phi": "2-ne",
        "gia cốp": "jacob", "gia cop": "jacob",
        "ê nốt": "enos", "e not": "enos",
        "gia rôm": "jarom", "gia rom": "jarom",
        "ôm ni": "omni", "om ni": "omni",
        "lời mặc môn": "w-of-m", "loi mac mon": "w-of-m",
        "mô si a": "mosiah", "mo si a": "mosiah",
        "an ma": "alma",
        "hê la man": "hel", "he la man": "hel",
        "3 nê phi": "3-ne", "3 ne phi": "3-ne",
        "4 nê phi": "4-ne", "4 ne phi": "4-ne",
        "mặc môn": "morm", "mac mon": "morm",
        "ê the": "eth", "e the": "eth",
        "mô rô ni": "moro", "mo ro ni": "moro",

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

        // Japanese Old Testament
        "創世記": "gen", "出エジプト記": "ex", "レビ記": "lev", "民数記": "num", "申命記": "deut",
        "ヨシュア記": "josh", "士師記": "judg", "ルツ記": "ruth",
        "サムエル記上": "1-sam", "サムエル記下": "2-sam", "列王記上": "1-kgs", "列王記下": "2-kgs",
        "歴代誌上": "1-chr", "歴代誌下": "2-chr", "エズラ記": "ezra", "ネヘミヤ記": "neh", "エステル記": "esth",
        "ヨブ記": "job", "詩篇": "ps", "箴言": "prov", "伝道の書": "eccl", "雅歌": "song",
        "イザヤ書": "isa", "エレミヤ書": "jer", "哀歌": "lam", "エゼキエル書": "ezek", "ダニエル書": "dan",
        "ホセア書": "hosea", "ヨエル書": "joel", "アモス書": "amos", "オバデヤ書": "obad", "ヨナ書": "jonah",
        "ミカ書": "micah", "ナホム書": "nahum", "ハバクク書": "hab", "ゼパニヤ書": "zeph", "ハガイ書": "hag",
        "ゼカリヤ書": "zech", "マラキ書": "mal",

        // Portuguese Old Testament
        "gênesis": "gen", "genesis": "gen",
        "êxodo": "ex", "exodo": "ex",
        "levítico": "lev", "levitico": "lev",
        "números": "num", "numeros": "num",
        "deuteronômio": "deut", "deuteronomio": "deut",
        "josué": "josh", "josue": "josh",
        "juízes": "judg", "juizes": "judg",
        "rute": "ruth",
        "1 samuel": "1-sam",
        "2 samuel": "2-sam",
        "1 reis": "1-kgs",
        "2 reis": "2-kgs",
        "1 crônicas": "1-chr", "1 cronicas": "1-chr",
        "2 crônicas": "2-chr", "2 cronicas": "2-chr",
        "esdras": "ezra",
        "neemias": "neh",
        "ester": "esth",
        "jó": "job", "jo": "job",
        "salmos": "ps",
        "provérbios": "prov", "proverbios": "prov",
        "eclesiastes": "eccl",
        "cânticos de salomão": "song", "canticos de salomao": "song",
        "isaías": "isa", "isaias": "isa",
        "jeremias": "jer",
        "lamentações": "lam", "lamentacoes": "lam",
        "ezequiel": "ezek",
        "daniel": "dan",
        "oseias": "hosea",
        "joel": "joel",
        "amós": "amos", "amos": "amos",
        "obadias": "obad",
        "jonas": "jonah",
        "miqueias": "micah",
        "naum": "nahum",
        "habacuque": "hab",
        "sofonias": "zeph",
        "ageu": "hag",
        "zacarias": "zech",
        "malaquias": "mal",

        // Traditional Chinese Old Testament
        "創世記": "gen", "出埃及記": "ex", "利未記": "lev", "民數記": "num", "申命記": "deut",
        "約書亞記": "josh", "士師記": "judg", "路得記": "ruth",
        "撒母耳記上": "1-sam", "撒母耳記下": "2-sam", "列王紀上": "1-kgs", "列王紀下": "2-kgs",
        "歷代志上": "1-chr", "歷代志下": "2-chr", "以斯拉記": "ezra", "尼希米記": "neh", "以斯帖記": "esth",
        "約伯記": "job", "詩篇": "ps", "箴言": "prov", "傳道書": "eccl", "雅歌": "song",
        "以賽亞書": "isa", "耶利米書": "jer", "耶利米哀歌": "lam", "以西結書": "ezek", "但以理書": "dan",
        "何西阿書": "hosea", "約珥書": "joel", "阿摩司書": "amos", "俄巴底亞書": "obad", "約拿書": "jonah",
        "彌迦書": "micah", "那鴻書": "nahum", "哈巴谷書": "hab", "西番雅書": "zeph", "哈該書": "hag",
        "撒迦利亞書": "zech", "瑪拉基書": "mal",

        // Spanish Old Testament
        "génesis": "gen", "genesis": "gen",
        "éxodo": "ex", "exodo": "ex",
        "levítico": "lev", "levitico": "lev",
        "números": "num", "numeros": "num",
        "deuteronomio": "deut",
        "josué": "josh", "josue": "josh",
        "jueces": "judg",
        "rut": "ruth",
        "1 samuel": "1-sam",
        "2 samuel": "2-sam",
        "1 reyes": "1-kgs",
        "2 reyes": "2-kgs",
        "1 crónicas": "1-chr", "1 cronicas": "1-chr",
        "2 crónicas": "2-chr", "2 cronicas": "2-chr",
        "esdras": "ezra",
        "nehemías": "neh", "nehemias": "neh",
        "ester": "esth",
        "job": "job",
        "salmos": "ps",
        "proverbios": "prov",
        "eclesiastés": "eccl", "eclesiastes": "eccl",
        "cantares": "song",
        "isaías": "isa", "isaias": "isa",
        "jeremías": "jer", "jeremias": "jer",
        "lamentaciones": "lam",
        "ezequiel": "ezek",
        "daniel": "dan",
        "oseas": "hosea",
        "joel": "joel",
        "amós": "amos", "amos": "amos",
        "abdías": "obad", "abdias": "obad",
        "jonás": "jonah", "jonas": "jonah",
        "miqueas": "micah",
        "nahúm": "nahum", "nahum": "nahum",
        "habacuc": "hab",
        "sofonías": "zeph", "sofonias": "zeph",
        "hageo": "hag",
        "zacarías": "zech", "zacarias": "zech",
        "malaquías": "mal", "malaquias": "mal",

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

        // Japanese New Testament
        "マタイによる福音書": "matt", "マタイ": "matt",
        "マルコによる福音書": "mark", "マルコ": "mark",
        "ルカによる福音書": "luke", "ルカ": "luke",
        "ヨハネによる福音書": "john", "ヨハネ": "john",
        "使徒行伝": "acts",
        "ローマ人への手紙": "rom", "ローマ": "rom",
        "コリント人への手紙第一": "1-cor", "コリント第一": "1-cor",
        "コリント人への手紙第二": "2-cor", "コリント第二": "2-cor",
        "ガラテヤ人への手紙": "gal", "ガラテヤ": "gal",
        "エペソ人への手紙": "eph", "エペソ": "eph",
        "ピリピ人への手紙": "philip", "ピリピ": "philip",
        "コロサイ人への手紙": "col", "コロサイ": "col",
        "テサロニケ人への手紙第一": "1-thes", "テサロニケ第一": "1-thes",
        "テサロニケ人への手紙第二": "2-thes", "テサロニケ第二": "2-thes",
        "テモテへの手紙第一": "1-tim", "テモテ第一": "1-tim",
        "テモテへの手紙第二": "2-tim", "テモテ第二": "2-tim",
        "テトスへの手紙": "titus", "テトス": "titus",
        "ピレモンへの手紙": "philem", "ピレモン": "philem",
        "ヘブル人への手紙": "heb", "ヘブル": "heb",
        "ヤコブの手紙": "jas", "ヤコブ": "jas",
        "ペテロの手紙第一": "1-pet", "ペテロ第一": "1-pet",
        "ペテロの手紙第二": "2-pet", "ペテロ第二": "2-pet",
        "ヨハネの手紙第一": "1-jn", "ヨハネ第一": "1-jn",
        "ヨハネの手紙第二": "2-jn", "ヨハネ第二": "2-jn",
        "ヨハネの手紙第三": "3-jn", "ヨハネ第三": "3-jn",
        "ユダの手紙": "jude", "ユダ": "jude",
        "ヨハネの黙示録": "rev", "黙示録": "rev",

        // Portuguese New Testament
        "mateus": "matt",
        "marcos": "mark",
        "lucas": "luke",
        "joão": "john", "joao": "john",
        "atos": "acts",
        "romanos": "rom",
        "1 coríntios": "1-cor", "1 corintios": "1-cor",
        "2 coríntios": "2-cor", "2 corintios": "2-cor",
        "gálatas": "gal", "galatas": "gal",
        "efésios": "eph", "efesios": "eph",
        "filipenses": "philip",
        "colossenses": "col",
        "1 tessalonicenses": "1-thes",
        "2 tessalonicenses": "2-thes",
        "1 timóteo": "1-tim", "1 timoteo": "1-tim",
        "2 timóteo": "2-tim", "2 timoteo": "2-tim",
        "tito": "titus",
        "filemom": "philem",
        "hebreus": "heb",
        "tiago": "jas",
        "1 pedro": "1-pet",
        "2 pedro": "2-pet",
        "1 joão": "1-jn", "1 joao": "1-jn",
        "2 joão": "2-jn", "2 joao": "2-jn",
        "3 joão": "3-jn", "3 joao": "3-jn",
        "judas": "jude",
        "apocalipse": "rev",

        // Traditional Chinese New Testament
        "馬太福音": "matt",
        "馬可福音": "mark",
        "路加福音": "luke",
        "約翰福音": "john",
        "使徒行傳": "acts",
        "羅馬書": "rom",
        "哥林多前書": "1-cor",
        "哥林多後書": "2-cor",
        "加拉太書": "gal",
        "以弗所書": "eph",
        "腓立比書": "philip",
        "歌羅西書": "col",
        "帖撒羅尼迦前書": "1-thes",
        "帖撒羅尼迦後書": "2-thes",
        "提摩太前書": "1-tim",
        "提摩太後書": "2-tim",
        "提多書": "titus",
        "腓利門書": "philem",
        "希伯來書": "heb",
        "雅各書": "jas",
        "彼得前書": "1-pet",
        "彼得後書": "2-pet",
        "約翰一書": "1-jn",
        "約翰二書": "2-jn",
        "約翰三書": "3-jn",
        "猶大書": "jude",
        "啟示錄": "rev",

        // Spanish New Testament
        "mateo": "matt",
        "marcos": "mark",
        "lucas": "luke",
        "juan": "john",
        "hechos": "acts",
        "romanos": "rom",
        "1 corintios": "1-cor",
        "2 corintios": "2-cor",
        "gálatas": "gal", "galatas": "gal",
        "efesios": "eph",
        "filipenses": "philip",
        "colosenses": "col",
        "1 tesalonicenses": "1-thes",
        "2 tesalonicenses": "2-thes",
        "1 timoteo": "1-tim",
        "2 timoteo": "2-tim",
        "tito": "titus",
        "filemón": "philem", "filemon": "philem",
        "hebreos": "heb",
        "santiago": "jas",
        "1 pedro": "1-pet",
        "2 pedro": "2-pet",
        "1 juan": "1-jn",
        "2 juan": "2-jn",
        "3 juan": "3-jn",
        "judas": "jude",
        "apocalipsis": "rev",

        // Pearl of Great Price
        "moses": "moses",
        "abraham": "abr", "abr": "abr",
        "joseph smith matthew": "js-m", "js-m": "js-m", "joseph smith-matthew": "js-m",
        "joseph smith history": "js-h", "js-h": "js-h", "joseph smith-history": "js-h",
        "articles of faith": "a-of-f", "a of f": "a-of-f",

        // Japanese Pearl of Great Price
        "モーセ書": "moses", "モーセ": "moses",
        "アブラハム書": "abr", "アブラハム": "abr",
        "ジョセフ・スミス—マタイ": "js-m",
        "ジョセフ・スミス—歴史": "js-h",
        "信仰箇条": "a-of-f",

        // Portuguese Pearl of Great Price
        "moisés": "moses", "moises": "moses",
        "abraão": "abr", "abraao": "abr",
        "joseph smith—mateus": "js-m", "joseph smith mateus": "js-m",
        "joseph smith—história": "js-h", "joseph smith história": "js-h", "joseph smith historia": "js-h",
        "regras de fé": "a-of-f", "regras de fe": "a-of-f",

        // Traditional Chinese Pearl of Great Price
        "摩西書": "moses",
        "亞伯拉罕書": "abr",
        "約瑟·斯密——馬太": "js-m",
        "約瑟·斯密——歷史": "js-h",
        "信條": "a-of-f",

        // Spanish Pearl of Great Price
        "moisés": "moses", "moises": "moses",
        "abraham": "abr",
        "josé smith—mateo": "js-m", "jose smith mateo": "js-m",
        "josé smith—historia": "js-h", "jose smith historia": "js-h",
        "artículos de fe": "a-of-f", "articulos de fe": "a-of-f",

        // Vietnamese Pearl of Great Price
        "môi se": "moses", "moi se": "moses",
        "áp ra ham": "abr", "ap ra ham": "abr",
        "giô sép smith—ma thi ơ": "js-m", "gio sep smith ma thi o": "js-m",
        "giô sép smith—lịch sử": "js-h", "gio sep smith lich su": "js-h",
        "những tín điều": "a-of-f", "nhung tin dieu": "a-of-f"
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
