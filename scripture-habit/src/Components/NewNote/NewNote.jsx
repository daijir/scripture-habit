import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import { UilTimes, UilImageUpload, UilTrashAlt } from '@iconscout/react-unicons';
import Select from 'react-select';
import { ScripturesOptions } from '../../Data/Data';
import Checkbox from '../Input/Checkbox';
import Input from '../Input/Input';
import './NewNote.css'; // Renamed CSS import

const NewNote = ({ isOpen, onClose, userData, noteToEdit, onDelete }) => {
    //Form fields
    const [chapter, setChapter] = useState(''); // Renamed from newNote/newEntry
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Keeping these for potential future image support
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    React.useEffect(() => {
        if (isOpen && noteToEdit) {
            let text = noteToEdit.text || '';

            // Remove header lines if present
            text = text.replace(/📖 \*\*New Study Note\*\*\n+/, '');
            text = text.replace(/📖 \*\*New Study Entry\*\*\n+/, '');

            // Extract Chapter (or Title for backward compatibility)
            // Matches "**Chapter:** " or "**Title:** " followed by anything until a newline or end of string
            const chapterMatch = text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
            const chap = chapterMatch ? chapterMatch[1].trim() : '';

            // Extract Scripture
            // Matches "**Scripture:** " followed by anything until a newline or end of string
            const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
            const script = scriptureMatch ? scriptureMatch[1].trim() : '';

            // Extract Comment
            // Everything after the scripture line
            let comm = '';
            if (scriptureMatch) {
                // Find the end of the scripture match
                const scriptureEndIndex = scriptureMatch.index + scriptureMatch[0].length;
                // Get the rest of the string
                comm = text.substring(scriptureEndIndex).trim();
            } else {
                // Fallback: if no scripture found, maybe it's all comment? 
                // Or try to strip chapter/title if found.
                if (chapterMatch) {
                    const chapterEndIndex = chapterMatch.index + chapterMatch[0].length;
                    comm = text.substring(chapterEndIndex).trim();
                } else {
                    comm = text;
                }
            }

            setChapter(chap);
            setScripture(script);
            setComment(comm);

            // Find option for select (case-insensitive search)
            const option = ScripturesOptions.find(opt => opt.value.toLowerCase() === script.toLowerCase());
            setSelectedOption(option || null);
            setIsPublic(true);

        } else if (isOpen && !noteToEdit) {
            setChapter('');
            setScripture('');
            setComment('');
            setSelectedOption(null);
            setIsPublic(true);
        }
    }, [isOpen, noteToEdit]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!chapter || !scripture) {
            setError("Please fill in the chapter and select a scripture.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;

            if (noteToEdit) {
                // UPDATE EXISTING NOTE
                const messageRef = doc(db, 'groups', userData.groupId, 'messages', noteToEdit.id);
                await updateDoc(messageRef, {
                    text: messageText,
                });
                toast.success("Note updated successfully!");
            } else {
                // CREATE NEW NOTE
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
                        totalNotes: increment(1) // Renamed from totalEntries
                    });

                    // 3. Announcement in Group Chat
                    if (userData.groupId && newStreak > 0) {
                        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
                        await addDoc(messagesRef, {
                            text: `🎉🎉🎉 **${userData.nickname} reached a ${newStreak} day streak! Way to go!!** 🎉🎉🎉`,
                            senderId: 'system',
                            senderNickname: 'Scripture Habit Bot',
                            createdAt: serverTimestamp(),
                            isSystemMessage: true
                        });
                    }
                } else {
                    await updateDoc(userRef, {
                        lastPostDate: serverTimestamp(),
                        totalNotes: increment(1) // Renamed from totalEntries
                    });
                }

                // 4. Share Note to Group Chat
                if (isPublic && userData.groupId) {
                    const messagesRef = collection(db, 'groups', userData.groupId, 'messages');

                    await addDoc(messagesRef, {
                        text: messageText,
                        senderId: userData.uid,
                        senderNickname: userData.nickname,
                        createdAt: serverTimestamp(),
                        isNote: true // Renamed from isEntry
                    });
                }
                toast.success("Note posted successfully!");
            }

            setLoading(false);
            onClose();
            // Reset form
            setChapter('');
            setScripture('');
            setComment('');

        } catch (e) {
            console.error("Error saving note:", e);
            setError("Failed to save note. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="ModalOverlay" onClick={onClose}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 style={{ margin: 0 }}>{noteToEdit ? 'Edit Note' : 'New Note'}</h1>
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
                            title="Delete Note"
                        >
                            <UilTrashAlt size="24" />
                        </button>
                    )}
                </div>
                {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}

                {/* Scripture selection (react-select) */}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="scripture-select" style={{ display: 'block', marginBottom: '0.5rem', color: 'black' }}>Choose the scripture</label>
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

                {/* Chapter input */}
                <Input
                    label="Chapter"
                    type="text"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    required
                    placeholder="Enter a chapter (e.g. Alma 5)"
                />

                {/* Comment textarea */}
                <Input
                    label="Comment"
                    as="textarea" //Custom Input componet supports textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder="Enter a comment (e.g. This chapter reminded me that true conversion begins in the heart.)"
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
                        {loading ? 'Saving...' : (noteToEdit ? 'Update Note' : 'Post Note')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewNote;