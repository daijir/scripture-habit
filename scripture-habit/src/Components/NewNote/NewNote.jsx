import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UilTrashAlt } from '@iconscout/react-unicons';
import Select from 'react-select';
import { ScripturesOptions } from '../../Data/Data';
import Input from '../Input/Input';
import './NewNote.css';

const NewNote = ({ isOpen, onClose, userData, noteToEdit, onDelete, userGroups = [], isGroupContext = false }) => {

    const [chapter, setChapter] = useState('');
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [comment, setComment] = useState('');

    // New sharing states
    const [shareOption, setShareOption] = useState('all'); // 'all', 'specific', 'none', 'current'
    const [selectedShareGroups, setSelectedShareGroups] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

            const option = ScripturesOptions.find(opt => opt.value.toLowerCase() === script.toLowerCase());
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
    }, [isOpen, noteToEdit, userGroups.length, isGroupContext]);

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
            setError("Please fill in the chapter and select a scripture.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;

            if (noteToEdit) {
                // Editing an existing note (which is a message in a specific group)
                const messageRef = doc(db, 'groups', userData.groupId, 'messages', noteToEdit.id);
                await updateDoc(messageRef, {
                    text: messageText,
                });
                toast.success("Note updated successfully!");
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

                    const targetGroupIds = userGroups.map(g => g.id);

                    if (newStreak > 0) {
                        for (const gid of targetGroupIds) {
                            const messagesRef = collection(db, 'groups', gid, 'messages');
                            await addDoc(messagesRef, {
                                text: `🎉🎉🎉 **${userData.nickname} reached a ${newStreak} day streak! Way to go!!** 🎉🎉🎉`,
                                senderId: 'system',
                                senderNickname: 'Scripture Habit Bot',
                                createdAt: serverTimestamp(),
                                isSystemMessage: true
                            });
                        }
                    }
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
                } else if (shareOption === 'current' && userData.groupId) {
                    groupsToPostTo = [userData.groupId];
                }

                // Post to each target group
                const postPromises = groupsToPostTo.map(gid => {
                    const messagesRef = collection(db, 'groups', gid, 'messages');
                    return addDoc(messagesRef, {
                        text: messageText,
                        senderId: userData.uid,
                        senderNickname: userData.nickname,
                        createdAt: serverTimestamp(),
                        isNote: true
                    });
                });

                // ALWAYS save to personal notes collection as well, regardless of sharing option
                const personalNoteRef = collection(db, 'users', userData.uid, 'notes');
                await addDoc(personalNoteRef, {
                    text: messageText,
                    createdAt: serverTimestamp(),
                    scripture: scripture,
                    chapter: chapter,
                    comment: comment,
                    shareOption: shareOption,
                    sharedWithGroups: shareOption === 'specific' ? selectedShareGroups : (shareOption === 'all' ? userGroups.map(g => g.id) : (shareOption === 'current' && userData.groupId ? [userData.groupId] : []))
                });

                await Promise.all(postPromises);

                toast.success("Note posted successfully!");
            }

            setLoading(false);
            onClose();
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

                <Input
                    label="Chapter"
                    type="text"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    required
                    placeholder="Enter a chapter (e.g. Alma 5)"
                />

                <Input
                    label="Comment"
                    as="textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder="Enter a comment (e.g. This chapter reminded me that true conversion begins in the heart.)"
                />

                {!noteToEdit && (
                    <div className="sharing-options">
                        <label className="sharing-label">Share with:</label>

                        <div className="radio-group">
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="all"
                                    checked={shareOption === 'all'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>All my groups</span>
                            </label>

                            {isGroupContext && userData.groupId && (
                                <label className="radio-option">
                                    <input
                                        type="radio"
                                        value="current"
                                        checked={shareOption === 'current'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                    />
                                    <span>This Group</span>
                                </label>
                            )}

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="specific"
                                    checked={shareOption === 'specific'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>Specific groups</span>
                            </label>

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="none"
                                    checked={shareOption === 'none'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>Do not share (Private)</span>
                            </label>
                        </div>

                        {shareOption === 'specific' && (
                            <div className="group-selection-list">
                                {userGroups.length === 0 && (
                                    <p style={{ color: 'var(--black)', fontStyle: 'italic', padding: '0.5rem' }}>
                                        No groups found.
                                    </p>
                                )}
                                {userGroups.map(group => (
                                    <label key={group.id} className="group-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedShareGroups.includes(group.id)}
                                            onChange={() => handleGroupSelection(group.id)}
                                        />
                                        <span>{group.name || 'Unnamed Group'}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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