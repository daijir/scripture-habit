import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import { UilPlus, UilSignOutAlt, UilCopy, UilTrashAlt, UilTimes } from '@iconscout/react-unicons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayRemove, where, getDocs, increment, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import NewNote from '../NewNote/NewNote';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';

const GroupChat = ({ groupId, userData, userGroups, isActive = false }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!groupId) return;

    setLoading(true);

    const groupRef = doc(db, 'groups', groupId);
    const unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setGroupData(docSnap.data());
      }
    });

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt'));

    const unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("Error fetching messages:", err);
        setError("Failed to load messages.");
      }
      setLoading(false);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMessages();
    };
  }, [groupId]);

  // Update read status when viewing the group (only when isActive)
  useEffect(() => {
    if (!isActive || !userData || !groupId || !groupData) return;

    const updateReadStatus = async () => {
      const currentCount = groupData.messageCount || 0;
      const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', groupId);

      try {
        await setDoc(userGroupStateRef, {
          readMessageCount: currentCount,
          lastReadAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error("Error updating read status:", error);
      }
    };

    updateReadStatus();
  }, [groupId, groupData, userData, isActive]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (newMessage.trim() === '' || !userData) return;

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    try {
      const messageData = {
        text: newMessage,
        createdAt: serverTimestamp(),
        senderId: userData.uid,
        senderNickname: userData.nickname,
        isNote: false,
        isEntry: false,
      };

      if (replyTo) {
        messageData.replyTo = {
          id: replyTo.id,
          senderNickname: replyTo.senderNickname,
          text: replyTo.text ? (replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '')) : 'Image/Note'
        };
      }

      await addDoc(messagesRef, messageData);

      // Increment message count
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        messageCount: increment(1),
        lastMessageAt: serverTimestamp()
      });

      setNewMessage('');
      setReplyTo(null);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (e) {
      console.error("Error sending message:", e);
      toast.error(`Failed to send message: ${e.message || e}`);
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLeaveGroup = async () => {
    if (!userData || !groupId) return;

    try {
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch('/api/leave-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to leave group');
      }

      toast.success("You have left the group.");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error(`Failed to leave group: ${error.message}`);
    } finally {
      setShowLeaveModal(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!userData || !groupId || !groupData) return;

    if (deleteConfirmationName !== groupData.name) {
      toast.error("Group name does not match.");
      return;
    }

    try {
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch('/api/delete-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete group');
      }

      toast.success("Group deleted successfully.");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(`Failed to delete group: ${error.message}`);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {

      if (window.innerWidth > 768) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  const formatNoteForDisplay = (text) => {
    if (!text) return '';
    let content = text;

    const headerMatch = content.match(/^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/);
    const header = headerMatch ? headerMatch[0] : '';

    let body = content.replace(/^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/, '');

    const chapterMatch = body.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = body.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
      const chapter = chapterMatch[1].trim();
      const scripture = scriptureMatch[1].trim();
      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const maxEnd = Math.max(chapterEnd, scriptureEnd);

      const comment = body.substring(maxEnd).trim();

      return `${header}${scripture}\n${chapter}\n\n**Comment:**\n${comment}`;
    }

    return content;
  };

  const togglePublicStatus = async () => {
    if (!groupData || !groupId) return;
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        isPublic: !groupData.isPublic
      });
      toast.success(`Group is now ${!groupData.isPublic ? 'Public' : 'Private'}`);
    } catch (error) {
      console.error("Error updating group status:", error);
      toast.error("Failed to update group status");
    }
  };

  const handleCopyInviteCode = () => {
    if (groupData && groupData.inviteCode) {
      navigator.clipboard.writeText(groupData.inviteCode);
      toast.success("Invite code copied to clipboard!");
    }
  };

  return (
    <div className="GroupChat">
      <NewNote isOpen={isNewNoteOpen} onClose={() => setIsNewNoteOpen(false)} userData={userData} isGroupContext={true} userGroups={userGroups} currentGroupId={groupId} />
      <div className="chat-header">
        <h2>{groupData ? groupData.name : t('groupChat.groupName')}</h2>
        {groupData && (
          <div className="header-right">
            {userData.uid === groupData.ownerUserId && (
              <div className="group-status-toggle">
                <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={groupData.isPublic || false}
                    onChange={togglePublicStatus}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            )}
            <div className="invite-code-display" onClick={handleCopyInviteCode} title="Copy Invite Code">
              <span>{t('groupChat.inviteCode')}: <strong>{groupData.inviteCode}</strong></span>
              <UilCopy size="16" className="copy-icon" />
            </div>
            {userData.uid === groupData.ownerUserId ? (
              <button className="leave-group-btn delete-group-btn" onClick={() => setShowDeleteModal(true)} title={t('groupChat.deleteGroup')}>
                <UilTrashAlt size="20" />
              </button>
            ) : (
              <button className="leave-group-btn" onClick={() => setShowLeaveModal(true)} title={t('groupChat.leaveGroup')}>
                <UilSignOutAlt size="20" />
              </button>
            )}
          </div>
        )}
      </div>

      {showLeaveModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3>{t('groupChat.leaveGroup')}?</h3>
            <p>{t('groupChat.leaveConfirmMessage')}</p>
            <div className="leave-modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)}>{t('groupChat.cancel')}</button>
              <button className="modal-btn leave" onClick={handleLeaveGroup}>{t('groupChat.confirmLeave')}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3 className="delete-modal-title">{t('groupChat.deleteGroup')}?</h3>
            <p>This action cannot be undone. All messages and data will be permanently lost.</p>
            <p>Please type <strong>{groupData.name}</strong> to confirm.</p>
            <input
              type="text"
              className="delete-confirmation-input"
              value={deleteConfirmationName}
              onChange={(e) => setDeleteConfirmationName(e.target.value)}
              placeholder="Enter group name"
            />
            <div className="leave-modal-actions">
              <button className="modal-btn cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmationName(''); }}>{t('groupChat.cancel')}</button>
              <button
                className="modal-btn leave"
                onClick={handleDeleteGroup}
                disabled={deleteConfirmationName !== groupData?.name}
              >
                {t('groupChat.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="messages-container" ref={containerRef}>
        {loading && <p>Loading messages...</p>}
        {error && <p className="error-message">{error}</p>}
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const currentDate = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date();
          const prevDate = prevMsg?.createdAt?.seconds ? new Date(prevMsg.createdAt.seconds * 1000) : null;

          let showDateSeparator = false;
          if (!prevDate) {
            showDateSeparator = true;
          } else if (currentDate.toDateString() !== prevDate.toDateString()) {
            showDateSeparator = true;
          }

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="date-separator">
                  <span>{currentDate.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
                </div>
              )}
              {msg.senderId === 'system' || msg.isSystemMessage ? (
                <div className="message system-message">
                  <div className="message-content">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div
                  className={`message ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}
                  onClick={() => handleReply(msg)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="sender-name">{msg.senderNickname}</span>
                  <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
                    {msg.senderId === userData?.uid && (
                      <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                        {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    )}
                    <div className="message-bubble-column" style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', alignItems: msg.senderId === userData?.uid ? 'flex-end' : 'flex-start' }}>
                      {msg.replyTo && (
                        <div className="reply-context-label">
                          <span className="reply-context-prefix">{t('groupChat.replyTo')} </span>
                          <span className="reply-context-name">{msg.replyTo.senderNickname}</span>
                          <span className="reply-context-separator">: </span>
                          <span className="reply-context-text">{msg.replyTo.text}</span>
                        </div>
                      )}
                      <div className="message-content">
                        {msg.text && (
                          (msg.isNote || msg.isEntry) ? (
                            <div className="entry-message-content">
                              <ReactMarkdown>{formatNoteForDisplay(msg.text)}</ReactMarkdown>
                              {(() => {
                                const chapterMatch = msg.text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
                                const scriptureMatch = msg.text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
                                if (chapterMatch && scriptureMatch) {
                                  const scripture = scriptureMatch[1].trim();
                                  const chapter = chapterMatch[1].trim();
                                  const url = getGospelLibraryUrl(scripture, chapter, language);
                                  if (url) {
                                    return (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          display: 'inline-block',
                                          marginTop: '5px',
                                          fontSize: '0.75rem',
                                          color: msg.senderId === userData?.uid ? 'white' : 'var(--gray)',
                                          textDecoration: 'none',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        {t('dashboard.readInGospelLibrary')}
                                      </a>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <p>{msg.text}</p>
                          )
                        )}
                      </div>
                    </div>
                    {msg.senderId !== userData?.uid && (
                      <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                        {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <form onSubmit={handleSendMessage} className="send-message-form">
        {replyTo && (
          <div className="reply-preview">
            <div className="reply-info">
              <span className="replying-to">{t('groupChat.replyingTo')} <strong>{replyTo.senderNickname}</strong></span>
              <p className="reply-text-preview">{replyTo.text ? (replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '')) : 'Image/Note'}</p>
            </div>
            <div className="cancel-reply" onClick={() => setReplyTo(null)}>
              <UilTimes size="16" />
            </div>
          </div>
        )}
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('groupChat.typeMessage')}
            rows={1}
          />
          <div className="add-entry-btn" onClick={() => setIsNewNoteOpen(true)}>
            <UilPlus />
          </div>
          <button type="submit">{t('groupChat.send')}</button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;