import React, { useState } from 'react';
import './NewEntry.css';
import { ScripturesOptions } from '../../Data/Data';
import Select from 'react-select';
import Checkbox from '../Input/Checkbox';
import Input from '../Input/Input';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment } from 'firebase/firestore';

const NewEntry = ({ isOpen, onClose, userData }) => {
    //Form fields
    const [newEntry, setNewEntry] = useState('');
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(true); // Default to public
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!newEntry || !scripture) {
            setError("Please fill in the title and select a scripture.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Create Post
            /* 
            // Temporarily disabled due to permission issues
            const postData = {
                title: newEntry,
                scripture: scripture,
                comment: comment,
                userId: userData.uid,
                userNickname: userData.nickname,
                groupId: userData.groupId,
                isPublic: isPublic,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'groups', userData.groupId, 'posts'), postData);
            */

            // 2. Update Streak
            const userRef = doc(db, 'users', userData.uid);
            const userSnap = await getDoc(userRef);
            const currentUserData = userSnap.data();

            const timeZone = currentUserData.timeZone || 'UTC';
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA', { timeZone });

            let lastPostDate = null;
            if (currentUserData.lastPostDate) {
                if (typeof currentUserData.lastPostDate.toDate === 'function') {
                    lastPostDate = currentUserData.lastPostDate.toDate();
                } else {
                    lastPostDate = new Date(currentUserData.lastPostDate);
                }
            }

            let newStreak = currentUserData.streakCount || 0;
            let streakUpdated = false;

            if (!lastPostDate) {
                // First post ever
                newStreak = 1;
                streakUpdated = true;
            } else {
                const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });

                if (todayStr !== lastPostDateStr) {
                    // It's a new day
                    const todayDate = new Date(todayStr);
                    const lastPostDateObj = new Date(lastPostDateStr);
                    const diffTime = todayDate - lastPostDateObj;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        // Consecutive day
                        newStreak += 1;
                        streakUpdated = true;
                    } else {
                        // Streak broken
                        newStreak = 1;
                        streakUpdated = true; 
                    }
                } else {
                    // Same day correction
                    if (newStreak === 0) {
                        newStreak = 1;
                        streakUpdated = true;
                    }
                }
            }

            if (streakUpdated) {
                await updateDoc(userRef, {
                    streakCount: newStreak,
                    lastPostDate: serverTimestamp(),
                    totalEntries: increment(1)
                });

                // 3. Announcement in Group Chat
                if (userData.groupId && newStreak > 0) {
                    const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
                    await addDoc(messagesRef, {
                        text: `🎉 ${userData.nickname} reached a ${newStreak} day streak! Way to go!!`,
                        senderId: 'system', 
                        senderNickname: 'Scripture Habit Bot',
                        createdAt: serverTimestamp(),
                        isSystemMessage: true 
                    });
                }
            } else {
                // Just update lastPostDate if it was today (to keep it fresh? maybe not needed if we only care about streak date)
                // But let's update it to show latest activity
                await updateDoc(userRef, {
                    lastPostDate: serverTimestamp(),
                    totalEntries: increment(1)
                });
            }

            // 4. Share Entry to Group Chat
            if (isPublic && userData.groupId) {
                const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
                const messageText = `📖 **New Study Entry**\n\n**Title:** ${newEntry}\n**Scripture:** ${scripture}\n\n${comment}`;
                
                await addDoc(messagesRef, {
                    text: messageText,
                    senderId: userData.uid,
                    senderNickname: userData.nickname,
                    createdAt: serverTimestamp(),
                    isEntry: true
                });
            }

            setLoading(false);
            onClose();
            // Reset form
            setNewEntry('');
            setScripture('');
            setComment('');

        } catch (e) {
            console.error("Error creating entry:", e);
            setError("Failed to create entry. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="ModalOverlay" onClick={onClose}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                <h1>New Entry</h1>
                {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}

                {/* Title input */}
                <Input
                    label="Title"
                    type="text"
                    value={newEntry}
                    onChange={(e) => setNewEntry(e.target.value)}
                    required
                />

                {/* Scripture selection (react-select) */}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="scripture-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Choose the scripture</label>
                    <Select
                        options={ScripturesOptions}
                        onChange={(option) => {
                            setSelectedOption(option);
                            setScripture(option?.value);
                        }}
                        value={selectedOption}
                        placeholder="Please choose a scripture option"
                        styles={{
                            control: (base) => ({
                                ...base,
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderColor: '#ddd',
                                borderRadius: '0.5rem',
                                padding: '0.2rem',
                            }),
                            menu: (base) => ({
                                ...base,
                                zIndex: 100
                            })
                        }}
                    />
                </div>

                {/* Comment textarea */}
                <Input
                    label="Comment"
                    as="textarea" //Custom Input componet supports textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                {/* Visibility option */}
                <Checkbox
                    label="Share with my group"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                />

                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} className="cancel-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#ddd', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={loading} className="submit-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--pink)', color: 'white', cursor: 'pointer' }}>
                        {loading ? 'Posting...' : 'Post Entry'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewEntry;