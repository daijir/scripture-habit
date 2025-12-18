/**
 * LDS.orgのURL内の言語パラメータを現在のユーザー設定に合わせて置換します。
 * 例: lang=jpn -> lang=eng
 */
export const localizeLdsUrl = (url, langCode) => {
    if (!url || !url.includes('lang=')) return url;

    // アプリの言語コードをLDSの言語パラメータに変換
    const ldsLangMap = {
        'ja': 'jpn',
        'en': 'eng',
        'es': 'spa',
        'pt': 'por',
        'ko': 'kor',
        'zh': 'zho',
        'vi': 'vie',
        'th': 'tha',
        'tl': 'tgl'
    };

    const targetLang = ldsLangMap[langCode] || 'eng';

    // lang=xxx の部分を探して置換
    const urlObj = new URL(url);
    urlObj.searchParams.set('lang', targetLang);

    return urlObj.toString();
};
