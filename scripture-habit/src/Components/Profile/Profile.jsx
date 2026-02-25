import React, { useState, useEffect } from 'react';
import './Profile.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import { useSettings } from '../../Context/SettingsContext.jsx';
import { auth, db, storage } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { UilSignOutAlt, UilCamera } from '@iconscout/react-unicons';
import { doc, updateDoc, deleteDoc, collection, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { deleteUser } from 'firebase/auth';
import Button from '../Button/Button';
import { toast } from 'react-toastify';
import Footer from '../Footer/Footer';
import { requestNotificationPermission, disableNotifications } from '../../Utils/notificationHelper';

const Profile = ({ userData, stats }) => {
    const { language, setLanguage, t } = useLanguage();
    const { fontSize, setFontSize } = useSettings();
    const navigate = useNavigate();
    const [nickname, setNickname] = useState('');
    const [stake, setStake] = useState('');
    const [ward, setWard] = useState('');
    const [bio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmNickname, setConfirmNickname] = useState('');
    const [notifPermission, setNotifPermission] = useState(window.Notification ? window.Notification.permission : 'default');
    const [isNotifLoading, setIsNotifLoading] = useState(false);
    const [photoURL, setPhotoURL] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    // PWA Install properties
    const [platform, setPlatform] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Platform detection
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsStandalone(standaloneCheck);

        if (!standaloneCheck) {
            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');
        }

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setPlatform('android');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        if (window.deferredPWAPrompt) {
            setDeferredPrompt(window.deferredPWAPrompt);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
    };

    useEffect(() => {
        if (window.Notification) {
            setNotifPermission(window.Notification.permission);
        }
    }, []);

    const handleToggleNotifications = async () => {
        if (!window.Notification || !userData?.uid) return;

        setIsNotifLoading(true);
        if (window.Notification.permission === 'granted' && notifPermission === 'granted') {
            const success = await disableNotifications(userData.uid);
            if (success) {
                setNotifPermission('default');
                toast.success(t('profile.notificationToggle.disabledSuccess'));
            }
        } else {
            try {
                await requestNotificationPermission(userData.uid, t);
                setNotifPermission(window.Notification.permission);
            } catch (err) {
                console.error("Toggle error:", err);
            }
        }
        setIsNotifLoading(false);
    };

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
        if (userData?.photoURL) {
            setPhotoURL(userData.photoURL);
        }
    }, [userData]);

    const resizeImage = (file, targetSize = 400) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Center Crop to Square
                    let sourceX, sourceY, sourceWidth, sourceHeight;
                    if (img.width > img.height) {
                        sourceWidth = img.height;
                        sourceHeight = img.height;
                        sourceX = (img.width - img.height) / 2;
                        sourceY = 0;
                    } else {
                        sourceWidth = img.width;
                        sourceHeight = img.width;
                        sourceX = 0;
                        sourceY = (img.height - img.width) / 2;
                    }

                    canvas.width = targetSize;
                    canvas.height = targetSize;

                    // Enable high quality image scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.drawImage(
                        img,
                        sourceX, sourceY, sourceWidth, sourceHeight, // Source
                        0, 0, targetSize, targetSize               // Destination
                    );

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.85); // Compress quality
                };
            };
        });
    };

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !userData?.uid) return;

        // Increased limit to 20MB for modern smartphone photos
        if (file.size > 20 * 1024 * 1024) {
            toast.error(t('profile.imageTooLarge') || "Image is too large. Please pick a smaller one.");
            return;
        }

        setIsUploading(true);
        try {
            // Automatically resize and crop to 400x400 square
            const resizedBlob = await resizeImage(file, 400);

            // Upload to Firebase Storage
            const storageRef = ref(storage, `profile_pictures/${userData.uid}.jpg`);
            await uploadBytes(storageRef, resizedBlob);

            // Get download URL
            const url = await getDownloadURL(storageRef);

            // Update user document in Firestore
            const userRef = doc(db, 'users', userData.uid);
            await updateDoc(userRef, { photoURL: url });

            setPhotoURL(url);
            toast.success(t('profile.imageUploadSuccess') || "Profile picture updated!");
        } catch (error) {
            console.error("Error uploading image:", error);
            toast.error(t('profile.imageUploadError') || "Failed to update profile picture.");
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

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
            setMessage({ type: 'success', text: t('profile.successUpdate') });

            // Clear message after 3 seconds
            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: t('profile.errorUpdate') });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = () => {
        setShowSignOutModal(true);
    };

    const confirmSignOut = () => {
        auth.signOut();
        navigate('/welcome');
        setShowSignOutModal(false);
    };

    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setIsDeleting(true);
        try {
            // --- STEP 1: Exit all groups first (for system stability) ---
            const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            for (const gid of groupIds) {
                try {
                    const groupRef = doc(db, 'groups', gid);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        const gData = groupSnap.data();
                        const members = gData.members || [];
                        const updatedMembers = members.filter(uid => uid !== user.uid);

                        if (gData.ownerUserId === user.uid) {
                            if (updatedMembers.length > 0) {
                                // Transfer ownership
                                await updateDoc(groupRef, {
                                    ownerUserId: updatedMembers[0],
                                    members: updatedMembers
                                });
                            } else {
                                // Delete group
                                await deleteDoc(groupRef);
                            }
                        } else {
                            // Leave group
                            await updateDoc(groupRef, {
                                members: updatedMembers
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Group cleanup failed for ${gid}:`, err);
                }
            }

            // --- STEP 2: Delete personal data in a batch ---
            const batch = writeBatch(db);

            // 1. Delete user notes
            const notesRef = collection(db, 'users', user.uid, 'notes');
            const notesSnapshot = await getDocs(notesRef);
            notesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // 2. Delete groupStates
            const statesRef = collection(db, 'users', user.uid, 'groupStates');
            const statesSnapshot = await getDocs(statesRef);
            statesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // 3. Delete letters
            const lettersRef = collection(db, 'users', user.uid, 'letters');
            const lettersSnapshot = await getDocs(lettersRef);
            lettersSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // 4. Finally, delete the profile
            const userRef = doc(db, 'users', user.uid);
            batch.delete(userRef);

            await batch.commit();

            // --- STEP 3: Delete from Firebase Auth ---
            try {
                await deleteUser(user);
                toast.success(t('profile.deleteAccountSuccess'));
                navigate('/welcome');
            } catch (authError) {
                console.error("Auth deletion failed:", authError);
                // Even if auth delete fails, the data is gone, so sign out is fine
                await auth.signOut();
                navigate('/welcome');
            }
        } catch (error) {
            console.error("Error during account deletion process:", error);
            toast.error(t('profile.deleteAccountError') || "Error deleting account");
            await auth.signOut();
            navigate('/welcome');
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="Profile DashboardContent">
            <div className="dashboard-header">
                <h1>{t('profile.title')}</h1>
                <p className="welcome-text">{t('profile.description')}</p>
            </div>

            <div className="profile-photo-section">
                <div className="avatar-container" onClick={handlePhotoClick}>
                    {photoURL ? (
                        <img src={photoURL} alt="Avatar" className="profile-avatar-img" />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {nickname ? nickname.substring(0, 1).toUpperCase() : '?'}
                        </div>
                    )}
                    <div className="avatar-overlay">
                        {isUploading ? <div className="spinner-small"></div> : <UilCamera size="24" color="white" />}
                    </div>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <p className="photo-hint">{t('profile.photoHint') || "Tap to change profile picture"}</p>
            </div>

            <div className="profile-section notification-toggle-section">
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('profile.notificationToggle.title')}</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray)', margin: '4px 0 0' }}>{t('profile.notificationToggle.description')}</p>
                </div>
                <div className="switch-wrapper">
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={notifPermission === 'granted'}
                            onChange={handleToggleNotifications}
                            disabled={isNotifLoading || notifPermission === 'denied'}
                        />
                        <span className="slider round"></span>
                    </label>
                    {notifPermission === 'denied' && (
                        <span className="status-blocked">{t('profile.notificationToggle.statusBlocked')}</span>
                    )}
                </div>
            </div>

            {/* PWA Install App Section */}
            {!isStandalone && platform && (
                <div className="profile-section" style={{ marginTop: '-0.5rem', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('profile.installApp.title') || (language === 'ja' ? 'アプリをインストール' : 'Install App')}</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray)', margin: '4px 0 12px' }}>
                        {t('profile.installApp.description') || (language === 'ja' ? 'ホーム画面に追加してアプリとしてご利用いただけます。' : 'Add to home screen for a better app experience.')}
                    </p>
                    {platform === 'ios' ? (
                        <div style={{ background: 'rgba(107, 70, 193, 0.05)', padding: '12px', borderRadius: '12px' }}>
                            <p style={{ fontSize: '0.9rem', color: '#4a5568', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {t('profile.installApp.iosInstruction') || (language === 'ja' ? 'Safariの下部中央にある「シェア」ボタンをタップし、「ホーム画面に追加」を選んでください。' : "Tap the Share button at the bottom of Safari, then select 'Add to Home Screen'.")}
                            </p>
                        </div>
                    ) : (
                        <Button
                            onClick={handleInstallClick}
                            style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                                background: !deferredPrompt ? undefined : 'linear-gradient(135deg, #FF919D 0%, #FF7081 100%)',
                                color: !deferredPrompt ? undefined : 'white'
                            }}
                            disabled={!deferredPrompt}
                        >
                            {t('profile.installApp.androidButton') || (language === 'ja' ? 'アプリをホーム画面に追加' : "Add to Home Screen")}
                        </Button>
                    )}
                </div>
            )}

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
                        <div className="level-section">
                            <div className="level-badge">
                                <span className="level-number">{Math.floor((stats.daysStudied || 0) / 7) + 1}</span>
                                <span className="level-text">{t('profile.level')}</span>
                            </div>
                            <div className="level-progress-container">
                                <div className="level-progress-info">
                                    <span>{t('profile.nextLevel')}</span>
                                    <span>{(stats.daysStudied || 0) % 7} / 7</span>
                                </div>
                                <div className="level-progress-bar">
                                    <div
                                        className="level-progress-fill"
                                        style={{ width: `${((stats.daysStudied || 0) % 7) / 7 * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-row">
                            <div className="stat-item">
                                <span className="stat-value">{stats.streak}</span>
                                <span className="stat-label">{t('dashboard.streak')} ({t('dashboard.days')})</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{stats.totalNotes}</span>
                                <span className="stat-label">{t('dashboard.totalNotes')}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{stats.daysStudied || 0}</span>
                                <span className="stat-label">{t('profile.daysStudied')}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>






            <div className="profile-section">
                <h2>{t('profile.fontSize.title')}</h2>
                <p style={{ marginBottom: '1.2rem', fontSize: '0.9rem', color: 'var(--gray)' }}>{t('profile.fontSize.description')}</p>
                <div className="font-size-options">
                    <div
                        className={`font-option ${fontSize === 'small' ? 'active' : ''}`}
                        onClick={() => setFontSize('small')}
                    >
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>A</span>
                        <span>{t('profile.fontSize.small')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'medium' ? 'active' : ''}`}
                        onClick={() => setFontSize('medium')}
                    >
                        <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>A</span>
                        <span>{t('profile.fontSize.medium')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'large' ? 'active' : ''}`}
                        onClick={() => setFontSize('large')}
                    >
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>A</span>
                        <span>{t('profile.fontSize.large')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'extraLarge' ? 'active' : ''}`}
                        onClick={() => setFontSize('extraLarge')}
                    >
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>A</span>
                        <span>{t('profile.fontSize.extraLarge')}</span>
                    </div>
                </div>
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

            <div className="profile-section" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--red)', marginTop: '20px', marginBottom: '20px' }} onClick={handleSignOut}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UilSignOutAlt />
                    <span style={{ fontSize: '1.2rem', fontWeight: '500' }}>{t('signOut.title')}</span>
                </div>
            </div>


            {/* Sign Out Confirmation Modal */}
            {
                showSignOutModal && (
                    <div className="group-modal-overlay" onClick={() => setShowSignOutModal(false)}>
                        <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px', textAlign: 'center' }}>
                            <h3>{t('signOut.title')}</h3>
                            <p>{t('signOut.message')}</p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                                <button
                                    className="close-modal-btn"
                                    onClick={() => setShowSignOutModal(false)}
                                    style={{ marginTop: 0, flex: 1 }}
                                >
                                    {t('signOut.cancel')}
                                </button>
                                <button
                                    className="close-modal-btn"
                                    onClick={confirmSignOut}
                                    style={{
                                        marginTop: 0,
                                        flex: 1,
                                        background: 'var(--pink)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    {t('signOut.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Account Deletion Verification */}
            <div className="profile-section" style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={() => {
                        setConfirmNickname('');
                        setShowDeleteModal(true);
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#a0aec0',
                        fontSize: '0.9rem',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                    }}
                >
                    {t('profile.deleteAccount')}
                </button>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="group-modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ color: 'var(--red)' }}>{t('profile.deleteAccount')}</h3>
                        <p style={{ margin: '1rem 0', lineHeight: '1.5', fontWeight: 'bold' }}>{t('profile.deleteAccountWarning')}</p>

                        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                                {t('profile.typeToConfirmNickname').replace('{nickname}', userData.nickname)}
                            </p>
                            <input
                                type="text"
                                value={confirmNickname}
                                onChange={(e) => setConfirmNickname(e.target.value)}
                                placeholder={userData.nickname}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                className={`close-modal-btn ${confirmNickname.trim() === userData.nickname.trim() ? 'delete-btn-active' : 'delete-btn-disabled'}`}
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || confirmNickname.trim() !== userData.nickname.trim()}
                                style={{ marginTop: 0 }}
                            >
                                {isDeleting ? '...' : t('profile.confirmDeleteAccount')}
                            </button>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowDeleteModal(false)}
                                style={{ marginTop: 0 }}
                            >
                                {t('profile.cancelDeleteAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <Footer />
        </div >
    );
};

export default Profile;
