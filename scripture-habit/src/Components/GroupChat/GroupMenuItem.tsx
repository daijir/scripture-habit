import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const GroupMenuItem = ({ group, currentGroupId, language, onSelect, timeZone = 'UTC' }) => {
    const [translatedName, setTranslatedName] = useState('');
    const translationAttemptedRef = useRef(false);

    /* 
     * Translation handling 
     */
    useEffect(() => {
        // 1. Check Firestore
        if (group.translations && group.translations[language] && group.translations[language].name) {
            setTranslatedName(group.translations[language].name);
            return;
        }

        // Check if we already attempted translation for this specific combination
        if (translationAttemptedRef.current) return;

        const autoTranslate = async () => {
            if (!group.name || !language) return;

            const cacheKey = `trans_name_${group.id}_${language}`;
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                setTranslatedName(cached);
                translationAttemptedRef.current = true;
                return;
            }

            translationAttemptedRef.current = true;

            try {
                const idToken = await auth.currentUser?.getIdToken();
                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';

                const response = await fetch(`${API_BASE}/api/translate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                    },
                    body: JSON.stringify({
                        text: group.name,
                        targetLanguage: language,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.translatedText) {
                        setTranslatedName(data.translatedText);
                        sessionStorage.setItem(cacheKey, data.translatedText);

                        // Save to Firestore (opportunistic)
                        try {
                            const groupRef = doc(db, 'groups', group.id);
                            await updateDoc(groupRef, {
                                [`translations.${language}.name`]: data.translatedText
                            });
                        } catch (e) {
                            console.error("Failed to save translation to Firestore", e);
                        }
                    }
                }
            } catch (error) {
                console.error('Error translating group name:', error);
            }
        };

        autoTranslate();
    }, [group.id, group.name, group.translations, language]);

    const getEmoji = (g) => {
        if (!g || !g.members || g.members.length === 0) return '🌑';

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const uniquePosters = new Set();

        // SOURCE 1: dailyActivity
        if (g.dailyActivity?.activeMembers && (g.dailyActivity.date === todayStr || g.dailyActivity.date === new Date().toDateString())) {
            g.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
        }

        // SOURCE 2: memberLastActive
        if (g.memberLastActive) {
            Object.entries(g.memberLastActive).forEach(([uid, ts]) => {
                let activeTime = 0;
                if (ts?.toDate) activeTime = ts.toDate().getTime();
                else if (ts?.seconds) activeTime = ts.seconds * 1000;
                if (activeTime >= todayTime) uniquePosters.add(uid);
            });
        }

        const percentage = Math.round((uniquePosters.size / g.members.length) * 100);

        if (percentage === 100) return '☀️';
        if (percentage >= 66) return '🌕';
        if (percentage >= 33) return '🌠';
        return '🌑';
    };

    const isActive = group.id === currentGroupId;
    const displayName = translatedName || group.name;

    return (
        <div
            className={`mobile-menu-item ${isActive ? 'active' : ''}`}
            onClick={onSelect}
            style={isActive ? { background: 'rgba(255, 145, 157, 0.1)', color: 'var(--pink)' } : {}}
        >
            <div className="menu-item-icon" style={isActive ? { color: 'var(--pink)' } : {}}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{getEmoji(group)}</span>
            </div>
            <span className="menu-item-label" style={isActive ? { fontWeight: 'bold' } : {}}>
                {displayName} {group.members && <span style={{ fontSize: '0.85em', color: isActive ? 'var(--pink)' : 'var(--gray)', opacity: 0.8, fontWeight: 'normal', marginLeft: '4px' }}>({group.members.length})</span>}
            </span>
            {group.unreadCount > 0 && (
                <span style={{
                    background: 'var(--pink)',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    marginLeft: 'auto',
                    minWidth: '20px',
                    textAlign: 'center'
                }}>
                    {group.unreadCount > 99 ? '99+' : group.unreadCount}
                </span>
            )}
        </div>
    );
};

export default GroupMenuItem;
