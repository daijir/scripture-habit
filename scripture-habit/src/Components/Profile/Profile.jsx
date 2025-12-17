import React, { useState, useEffect } from 'react';
import './Profile.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Button from '../Button/Button';

const Profile = ({ userData, stats }) => {
    const { language, setLanguage, t } = useLanguage();
    const [nickname, setNickname] = useState('');
    const [stake, setStake] = useState('');
    const [ward, setWard] = useState('');
    const [bio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (userData?.nickname) {
            setNickname(userData.nickname);
        }
        if (userData?.stake) {
            setStake(userData.stake);
        }
        if (userData?.ward) {
            setWard(userData.ward);
        }
        if (userData?.bio) {
            setBio(userData.bio);
        }
    }, [userData]);

    const handleSaveProfile = async () => {
        if (!nickname.trim()) return;
        const newStake = stake.trim();
        const newWard = ward.trim();
        const newBio = bio.trim();
        const newNickname = nickname.trim();

        if (newNickname === userData?.nickname && newStake === (userData?.stake || '') && newWard === (userData?.ward || '') && newBio === (userData?.bio || '')) return;

        setIsSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const userRef = doc(db, 'users', userData.uid);
            await updateDoc(userRef, {
                nickname: newNickname,
                stake: newStake,
                ward: newWard,
                bio: newBio
            });
            setMessage({ type: 'success', text: t('profile.save') + ' ' + t('groupChat.successUpdate') }); // Generic success message might be better

            // Clear message after 3 seconds
            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: t('groupChat.errorChangeNickname') }); // Or a more generic error
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="Profile DashboardContent">
            <div className="dashboard-header">
                <h1>{t('profile.title')}</h1>
                <p className="welcome-text">{t('profile.description')}</p>
            </div>

            <div className="profile-section">
                <div className="input-group">
                    <label className="input-label">{t('profile.nickname')}</label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder={t('groupChat.enterNewNickname')}
                        className="profile-input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">{t('profile.stake')}</label>
                    <input
                        type="text"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                        placeholder={t('profile.enterStake')}
                        className="profile-input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">{t('profile.ward')}</label>
                    <input
                        type="text"
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        placeholder={t('profile.enterWard')}
                        className="profile-input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">{t('profile.bio')}</label>
                    <input
                        type="text"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={t('profile.enterBio')}
                        className="profile-input"
                    />
                </div>
                <Button
                    onClick={handleSaveProfile}
                    disabled={isSaving || !nickname.trim() || (nickname === userData?.nickname && stake === (userData?.stake || '') && ward === (userData?.ward || '') && bio === (userData?.bio || ''))}
                    className="save-btn"
                >
                    {isSaving ? t('newNote.saving') : t('profile.save')}
                </Button>
                {message.text && (
                    <p className={`message ${message.type}`}>
                        {message.text}
                    </p>
                )}
                {stats && (
                    <div className="profile-stats">
                        <div className="stat-item">
                            <span className="stat-value">{stats.streak}</span>
                            <span className="stat-label">{t('dashboard.streak')} ({t('dashboard.days')})</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.totalNotes}</span>
                            <span className="stat-label">{t('dashboard.totalNotes')}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="profile-section">
                <h2>{t('profile.language')}</h2>
                <div className="language-options">
                    <div
                        className={`language-option ${language === 'en' ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                    >
                        <span className="lang-flag">🇺🇸</span>
                        <span className="lang-name">{t('languages.english')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'ja' ? 'active' : ''}`}
                        onClick={() => setLanguage('ja')}
                    >
                        <span className="lang-flag">🇯🇵</span>
                        <span className="lang-name">{t('languages.japanese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'pt' ? 'active' : ''}`}
                        onClick={() => setLanguage('pt')}
                    >
                        <span className="lang-flag">🇧🇷</span>
                        <span className="lang-name">{t('languages.portuguese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'zho' ? 'active' : ''}`}
                        onClick={() => setLanguage('zho')}
                    >
                        <span className="lang-flag">🇹🇼</span>
                        <span className="lang-name">{t('languages.chinese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'es' ? 'active' : ''}`}
                        onClick={() => setLanguage('es')}
                    >
                        <span className="lang-flag">🇪🇸</span>
                        <span className="lang-name">{t('languages.spanish')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'vi' ? 'active' : ''}`}
                        onClick={() => setLanguage('vi')}
                    >
                        <span className="lang-flag">🇻🇳</span>
                        <span className="lang-name">{t('languages.vietnamese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'th' ? 'active' : ''}`}
                        onClick={() => setLanguage('th')}
                    >
                        <span className="lang-flag">🇹🇭</span>
                        <span className="lang-name">{t('languages.thai')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'ko' ? 'active' : ''}`}
                        onClick={() => setLanguage('ko')}
                    >
                        <span className="lang-flag">🇰🇷</span>
                        <span className="lang-name">{t('languages.korean')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'tl' ? 'active' : ''}`}
                        onClick={() => setLanguage('tl')}
                    >
                        <span className="lang-flag">🇵🇭</span>
                        <span className="lang-name">{t('languages.tagalog')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'sw' ? 'active' : ''}`}
                        onClick={() => setLanguage('sw')}
                    >
                        <span className="lang-flag">🇰🇪</span>
                        <span className="lang-name">{t('languages.swahili')}</span>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Profile;
