/**
 * LDS.orgのURL内の言語パラメータを現在のユーザー設定に合わせて置換します。
 * 例: lang=jpn -> lang=eng
 */
export const localizeLdsUrl = (url: string | null | undefined, langCode: string): string | null | undefined => {
    if (!url || !url.includes('lang=')) return url;

    // アプリの言語コードをLDSの言語パラメータに変換
    const ldsLangMap: Record<string, string> = {
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

    try {
        // lang=xxx の部分を探して置換
        const urlObj = new URL(url);
        urlObj.searchParams.set('lang', targetLang);
        return urlObj.toString();
    } catch (e) {
        return url;
    }
};
