import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UilTrashAlt } from '@iconscout/react-unicons';
import Select from 'react-select';
import { ScripturesOptions } from '../../Data/Data';
import Input from '../Input/Input';
import './NewNote.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';

const NewNote = ({ isOpen, onClose, userData, noteToEdit, onDelete, userGroups = [], isGroupContext = false, currentGroupId = null }) => {
    const { t } = useLanguage();

    const [chapter, setChapter] = useState('');
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [comment, setComment] = useState('');

    // New sharing states
    const [shareOption, setShareOption] = useState('all'); // 'all', 'specific', 'none', 'current'
    const [selectedShareGroups, setSelectedShareGroups] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getTranslatedScriptureLabel = (value) => {
        switch (value) {
            case "Old Testament": return t('scriptures.oldTestament');
            case "New Testament": return t('scriptures.newTestament');
            case "Book of Mormon": return t('scriptures.bookOfMormon');
            case "Doctrine and Covenants": return t('scriptures.doctrineAndCovenants');
            case "Pearl of Great Price": return t('scriptures.pearlOfGreatPrice');
            default: return value;
        }
    };

    const translatedScripturesOptions = ScripturesOptions.map(option => ({
        ...option,
        label: getTranslatedScriptureLabel(option.value)
    }));

    React.useEffect(() => {
        if (isOpen && noteToEdit) {
            let text = noteToEdit.text || '';
            text = text.replace(/📖 \*\*New Study Note\*\*\n+/, '');
            text = text.replace(/📖 \*\*New Study Entry\*\*\n+/, '');

            const chapterMatch = text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
            const chap = chapterMatch ? chapterMatch[1].trim() : '';

            const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
            const script = scriptureMatch ? scriptureMatch[1].trim() : '';

            let comm = text;
            let maxIndex = 0;

            if (scriptureMatch) {
                const end = scriptureMatch.index + scriptureMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }
            if (chapterMatch) {
                const end = chapterMatch.index + chapterMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }

            if (maxIndex > 0) {
                comm = text.substring(maxIndex).trim();
            }

            setChapter(chap);
            setScripture(script);
            setComment(comm);

            const option = translatedScripturesOptions.find(opt => opt.value.toLowerCase() === script.toLowerCase());
            setSelectedOption(option || null);

            setShareOption('none');
            setSelectedShareGroups([]);

        } else if (isOpen && !noteToEdit) {
            setChapter('');
            setScripture('');
            setComment('');
            setSelectedOption(null);

            // Default sharing option logic
            if (isGroupContext) {
                setShareOption('current');
            } else {
                setShareOption(userGroups.length > 0 ? 'all' : 'none');
            }
            setSelectedShareGroups([]);
        }
    }, [isOpen, noteToEdit, userGroups.length, isGroupContext]); // Removed translatedScripturesOptions from dependency to avoid loop if not memoized, though t() change triggers re-render anyway.

    const handleGroupSelection = (groupId) => {
        setSelectedShareGroups(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
    };

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!chapter || !scripture) {
            setError(t('newNote.errorMissingFields'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;

            if (noteToEdit) {
                if (noteToEdit.groupMessageId && noteToEdit.groupId) {
                    // Editing a message directly from group chat
                    const messageRef = doc(db, 'groups', noteToEdit.groupId, 'messages', noteToEdit.groupMessageId);

                    // First get the message to check for originalNoteId
                    const messageSnap = await getDoc(messageRef);
                    const messageData = messageSnap.exists() ? messageSnap.data() : null;

                    await updateDoc(messageRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        editedAt: serverTimestamp(),
                        isEdited: true
                    });

                    // Sync to personal note if linked
                    if (messageData?.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', messageData.originalNoteId);
                            await updateDoc(noteRef, {
                                text: messageText,
                                scripture: scripture,
                                chapter: chapter,
                                comment: comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else if (isGroupContext) {
                    // Editing an existing note (which is a message in a specific group)
                    const targetGroupId = currentGroupId || userData.groupId;
                    const messageRef = doc(db, 'groups', targetGroupId, 'messages', noteToEdit.id);
                    await updateDoc(messageRef, {
                        text: messageText,
                    });

                    // Try to sync back to personal note if linked
                    if (noteToEdit.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.originalNoteId);
                            await updateDoc(noteRef, {
                                text: messageText,
                                scripture: scripture,
                                chapter: chapter,
                                comment: comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else {
                    // Editing a personal note
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    await updateDoc(noteRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        comment: comment
                    });

                    // SYNC TO GROUPS
                    // 1. Get the list of groups this note was shared with
                    let sharedMessageIds = noteToEdit.sharedMessageIds || {};
                    const groupsToCheck = noteToEdit.sharedWithGroups || [];
                    let idsUpdated = false;

                    for (const groupId of groupsToCheck) {
                        let messageId = sharedMessageIds[groupId];

                        if (!messageId) {
                            // Attempt to find the message in this group
                            try {
                                const messagesRef = collection(db, 'groups', groupId, 'messages');

                                // Strategy A: Check by originalNoteId (for future notes)
                                const qId = query(messagesRef, where('originalNoteId', '==', noteToEdit.id));
                                const snapId = await getDocs(qId);

                                if (!snapId.empty) {
                                    messageId = snapId.docs[0].id;
                                } else {
                                    // Strategy B: Check by content match (for legacy notes)
                                    // We look for a message by this user, that is a note, and has the OLD text
                                    const qText = query(messagesRef,
                                        where('senderId', '==', userData.uid),
                                        where('isNote', '==', true),
                                        where('text', '==', noteToEdit.text)
                                    );
                                    const snapText = await getDocs(qText);
                                    if (!snapText.empty) {
                                        messageId = snapText.docs[0].id;
                                        // Also update the message with originalNoteId for future robustness
                                        await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
                                            originalNoteId: noteToEdit.id
                                        });
                                    } else {
                                        // Strategy C: Check by Timestamp (approximate match)
                                        // Useful if text has been edited separately and they are out of sync
                                        if (noteToEdit.createdAt) {
                                            const noteTime = noteToEdit.createdAt.toDate ? noteToEdit.createdAt.toDate() : new Date(noteToEdit.createdAt.seconds * 1000);
                                            const startTime = new Date(noteTime.getTime() - 60000); // -1 minute
                                            const endTime = new Date(noteTime.getTime() + 60000); // +1 minute

                                            const qTime = query(messagesRef,
                                                where('senderId', '==', userData.uid),
                                                where('isNote', '==', true),
                                                where('createdAt', '>=', startTime),
                                                where('createdAt', '<=', endTime)
                                            );
                                            const snapTime = await getDocs(qTime);
                                            if (!snapTime.empty) {
                                                messageId = snapTime.docs[0].id;
                                                await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
                                                    originalNoteId: noteToEdit.id
                                                });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(`Error finding message in group ${groupId}:`, err);
                            }
                        }

                        if (messageId) {
                            try {
                                const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
                                await updateDoc(msgRef, { text: messageText });
                                sharedMessageIds[groupId] = messageId;
                                idsUpdated = true;
                            } catch (err) {
                                console.error(`Error updating message ${messageId} in group ${groupId}:`, err);
                            }
                        }
                    }

                    // Save the discovered IDs back to the note so we don't have to search next time
                    if (idsUpdated) {
                        await updateDoc(noteRef, { sharedMessageIds });
                    }
                }
                toast.success(t('newNote.successUpdate'));
            } else {
                // Creating a new note
                const userRef = doc(db, 'users', userData.uid);
                const userSnap = await getDoc(userRef);
                const currentUserData = userSnap.data();

                // Streak logic (simplified for brevity, keeping existing logic)
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
                    newStreak = 1;
                    streakUpdated = true;
                } else {
                    const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });
                    if (todayStr !== lastPostDateStr) {
                        const todayDate = new Date(todayStr);
                        const lastPostDateObj = new Date(lastPostDateStr);
                        const diffTime = todayDate - lastPostDateObj;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays === 1) {
                            newStreak += 1;
                            streakUpdated = true;
                        } else {
                            newStreak = 1;
                            streakUpdated = true;
                        }
                    } else {
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
                        totalNotes: increment(1)
                    });
                } else {
                    await updateDoc(userRef, {
                        lastPostDate: serverTimestamp(),
                        totalNotes: increment(1)
                    });
                }

                // Determine target groups for the note
                let groupsToPostTo = [];
                if (shareOption === 'all') {
                    groupsToPostTo = userGroups.map(g => g.id);
                } else if (shareOption === 'specific') {
                    groupsToPostTo = selectedShareGroups;
                } else if (shareOption === 'current') {
                    const targetId = currentGroupId || userData.groupId;
                    if (targetId) {
                        groupsToPostTo = [targetId];
                    }
                }

                // 1. Create the Personal Note FIRST to get its ID
                const personalNoteRef = await addDoc(collection(db, 'users', userData.uid, 'notes'), {
                    text: messageText,
                    createdAt: serverTimestamp(),
                    scripture: scripture,
                    chapter: chapter,
                    comment: comment,
                    shareOption: shareOption,
                    sharedWithGroups: groupsToPostTo // Store the array of group IDs
                });

                // 2. Post to each target group, linking back to the personal note
                const sharedMessageIds = {};

                // Use explicit timestamp for notes to ensure consistent ordering
                const noteTimestamp = Timestamp.now();

                const postPromises = groupsToPostTo.map(async (gid) => {
                    const messagesRef = collection(db, 'groups', gid, 'messages');
                    const msgRef = await addDoc(messagesRef, {
                        text: messageText,
                        senderId: userData.uid,
                        senderNickname: userData.nickname,
                        createdAt: noteTimestamp, // Use explicit timestamp
                        isNote: true,
                        originalNoteId: personalNoteRef.id // Link to personal note
                    });
                    sharedMessageIds[gid] = msgRef.id;
                });

                await Promise.all(postPromises);

                // 3. Update the Personal Note with the IDs of the shared messages
                if (Object.keys(sharedMessageIds).length > 0) {
                    await updateDoc(personalNoteRef, { sharedMessageIds });
                }

                // Send streak announcement AFTER note is posted
                // Use explicit timestamp that is 2 seconds AFTER the note timestamp
                if (streakUpdated && newStreak > 0) {
                    // Create announcement timestamp 2 seconds after note
                    const announcementTimestamp = Timestamp.fromMillis(noteTimestamp.toMillis() + 2000);

                    const targetGroupIds = userGroups.map(g => g.id);
                    for (const gid of targetGroupIds) {
                        const messagesRef = collection(db, 'groups', gid, 'messages');
                        await addDoc(messagesRef, {
                            text: `🎉🎉🎉 **${userData.nickname} reached a ${newStreak} day streak!!** 🎉🎉🎉\n\n**Let us edify one another in the group and share joy together!**`,
                            senderId: 'system',
                            senderNickname: 'Scripture Habit Bot',
                            createdAt: announcementTimestamp, // Explicit timestamp 2 seconds after note
                            isSystemMessage: true,
                            messageType: 'streakAnnouncement',
                            messageData: {
                                nickname: userData.nickname,
                                streak: newStreak
                            }
                        });
                    }
                }

                toast.success(t('newNote.successPost'));
            }

            setLoading(false);
            onClose();
            setChapter('');
            setScripture('');
            setComment('');

        } catch (e) {
            console.error("Error saving note:", e);
            setError(t('newNote.errorSave'));
            setLoading(false);
        }
    };

    return (
        <div className="ModalOverlay" onClick={onClose}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 style={{ margin: 0 }}>{noteToEdit ? t('newNote.editTitle') : t('newNote.newTitle')}</h1>
                    {noteToEdit && (
                        <button
                            onClick={onDelete}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#ff3b30',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.5rem'
                            }}
                            title={t('newNote.deleteTitle')}
                        >
                            <UilTrashAlt size="24" />
                        </button>
                    )}
                </div>
                {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="scripture-select" style={{ display: 'block', marginBottom: '0.5rem', color: 'black' }}>{t('newNote.chooseScriptureLabel')}</label>
                    <Select
                        options={translatedScripturesOptions}
                        onChange={(option) => {
                            setSelectedOption(option);
                            setScripture(option?.value);
                        }}
                        value={selectedOption}
                        placeholder={t('newNote.chooseScripturePlaceholder')}
                        styles={{
                            control: (base) => ({
                                ...base,
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderColor: '#ddd',
                                borderRadius: '0.5rem',
                                padding: '0.2rem',
                                color: 'black',
                            }),
                            placeholder: (base) => ({
                                ...base,
                                color: 'black',
                            }),
                            singleValue: (base) => ({
                                ...base,
                                color: 'black',
                            }),
                            option: (base, { isFocused, isSelected }) => ({
                                ...base,
                                color: 'black',
                                backgroundColor: isSelected ? 'rgba(255, 145, 157, 0.2)' : isFocused ? 'rgba(255, 145, 157, 0.1)' : null,
                                '&:active': {
                                    backgroundColor: 'rgba(255, 145, 157, 0.3)',
                                },
                            }),
                            menu: (base) => ({
                                ...base,
                                zIndex: 100,
                                color: 'black'
                            })
                        }}
                    />
                </div>

                <Input
                    label={t('newNote.chapterLabel')}
                    type="text"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    required
                    placeholder={t('newNote.chapterPlaceholder')}
                />

                <Input
                    label={t('newNote.commentLabel')}
                    as="textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder={t('newNote.commentPlaceholder')}
                />

                {!noteToEdit && (
                    <div className="sharing-options">
                        <label className="sharing-label">{t('newNote.shareLabel')}</label>

                        <div className="radio-group">
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="all"
                                    checked={shareOption === 'all'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareAll')}</span>
                            </label>

                            {isGroupContext && (currentGroupId || userData.groupId) && (
                                <label className="radio-option">
                                    <input
                                        type="radio"
                                        value="current"
                                        checked={shareOption === 'current'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                    />
                                    <span>{t('newNote.shareCurrent')}</span>
                                </label>
                            )}

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="specific"
                                    checked={shareOption === 'specific'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareSpecific')}</span>
                            </label>

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="none"
                                    checked={shareOption === 'none'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareNone')}</span>
                            </label>
                        </div>

                        {shareOption === 'specific' && (
                            <div className="group-selection-list">
                                {userGroups.length === 0 && (
                                    <p style={{ color: 'var(--black)', fontStyle: 'italic', padding: '0.5rem' }}>
                                        {t('newNote.noGroups')}
                                    </p>
                                )}
                                {userGroups.map(group => (
                                    <label key={group.id} className="group-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedShareGroups.includes(group.id)}
                                            onChange={() => handleGroupSelection(group.id)}
                                        />
                                        <span>{group.name || t('newNote.unnamedGroup')}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} className="cancel-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#ddd', cursor: 'pointer' }}>{t('newNote.cancel')}</button>
                    <button onClick={handleSubmit} disabled={loading} className="submit-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--pink)', color: 'white', cursor: 'pointer' }}>
                        {loading ? t('newNote.saving') : (noteToEdit ? t('newNote.update') : t('newNote.post'))}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewNote;