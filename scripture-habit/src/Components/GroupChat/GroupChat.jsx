import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import { UilPlus, UilSignOutAlt, UilCopy, UilTrashAlt } from '@iconscout/react-unicons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import NewNote from '../NewNote/NewNote'; // Renamed import
import './GroupChat.css';

const GroupChat = ({ groupId, userData }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false); // Renamed state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  // ... existing useEffects ...

  useEffect(() => {
    if (!groupId) return;

    setLoading(true);

    // Fetch group details
    const groupRef = doc(db, 'groups', groupId);
    const unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setGroupData(docSnap.data());
      }
    });

    // Fetch messages
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault(); // Handle both form submit and manual calls
    if (newMessage.trim() === '' || !userData) return;

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    try {
      await addDoc(messagesRef, {
        text: newMessage,
        createdAt: serverTimestamp(),
        senderId: userData.uid,
        senderNickname: userData.nickname,
        isNote: false, // Explicitly set isNote to false for regular chat messages
        isEntry: false, // Backward compatibility or explicit false
      });
      setNewMessage('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (e) {
      console.error("Error sending message:", e);
      toast.error(`Failed to send message: ${e.message || e}`);
    }
  };

  const handleLeaveGroup = async () => {
    if (!userData || !groupId) return;

    try {
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch('/leave-group', {
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
      navigate('/group-options');
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
      // 1. Update current user's groupId to empty
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        groupId: ''
      });

      // 2. Delete the group document
      // Note: Subcollections (messages) are not automatically deleted in Firestore client SDK.
      // They will become orphaned. For a production app, use a Cloud Function to delete recursively.
      await deleteDoc(doc(db, 'groups', groupId));

      toast.success("Group deleted successfully.");
      navigate('/group-options');
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(`Failed to delete group: ${error.message}`);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // On desktop, Enter sends. On mobile, Enter adds a new line (default behavior).
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

    // Remove header for parsing
    let body = content.replace(/^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/, '');

    const chapterMatch = body.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = body.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
      const chapter = chapterMatch[1].trim();
      const scripture = scriptureMatch[1].trim();

      // Find comment
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
      <NewNote isOpen={isNewNoteOpen} onClose={() => setIsNewNoteOpen(false)} userData={userData} />
      <div className="chat-header">
        <h2>{groupData ? groupData.name : 'Group Chat'}</h2> {/* Restored original header */}
        {groupData && (
          <div className="header-right">
            {userData.uid === groupData.ownerUserId && (
              <div className="group-status-toggle">
                <span className="status-label">{groupData.isPublic ? 'Public' : 'Private'}</span>
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
              <span>Invite Code: <strong>{groupData.inviteCode}</strong></span>
              <UilCopy size="16" className="copy-icon" />
            </div>
            {userData.uid === groupData.ownerUserId ? (
              <button className="leave-group-btn delete-group-btn" onClick={() => setShowDeleteModal(true)} title="Delete Group">
                <UilTrashAlt size="20" />
              </button>
            ) : (
              <button className="leave-group-btn" onClick={() => setShowLeaveModal(true)} title="Leave Group">
                <UilSignOutAlt size="20" />
              </button>
            )}
          </div>
        )}
        {/* Removed header button */}
      </div>

      {/* Leave Group Confirmation Modal */}
      {showLeaveModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3>Leave Group?</h3>
            <p>Are you sure you want to leave this group? You will need to find and join another group to participate again.</p>
            <div className="leave-modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              <button className="modal-btn leave" onClick={handleLeaveGroup}>Leave Group</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3 className="delete-modal-title">Delete Group?</h3>
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
              <button className="modal-btn cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmationName(''); }}>Cancel</button>
              <button
                className="modal-btn leave"
                onClick={handleDeleteGroup}
                disabled={deleteConfirmationName !== groupData?.name}
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="messages-container" ref={containerRef}>
        {loading && <p>Loading messages...</p>}
        {error && <p className="error-message">{error}</p>}
        {messages.map((msg) => {
          if (msg.senderId === 'system' || msg.isSystemMessage) {
            return (
              <div key={msg.id} className="message system-message">
                <div className="message-content">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`message ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
              <span className="sender-name">{msg.senderNickname}</span>
              <div className="message-content">
                {msg.text && (
                  (msg.isNote || msg.isEntry) ? ( // Check for both new and old flags
                    <div className="entry-message-content">
                      <ReactMarkdown>{formatNoteForDisplay(msg.text)}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.text}</p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSendMessage} className="send-message-form">
        <div className="input-wrapper">
          {/* Removed add-entry-btn */}
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Click + button to create a new note or type a message..."
            rows={1}
          />
          <div className="add-entry-btn" onClick={() => setIsNewNoteOpen(true)}> {/* Class name kept for CSS or rename later */}
            <UilPlus />
          </div>
          <button type="submit">Send</button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;