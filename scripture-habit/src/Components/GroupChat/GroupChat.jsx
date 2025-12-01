import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import { UilPlus } from '@iconscout/react-unicons';
import NewEntry from '../NewEntry/NewEntry';
import './GroupChat.css';

const GroupChat = ({ groupId, userData }) => { 
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const containerRef = useRef(null); // Restored containerRef
  const textareaRef = useRef(null); // Ref for the textarea

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
      console.error("Error fetching messages:", err);
      setError("Failed to load messages.");
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
        senderId: userData.uid, // Assuming userData has uid
        senderNickname: userData.nickname,
        isEntry: false, // Explicitly set isEntry to false for regular chat messages
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // On desktop, Enter sends. On mobile, Enter adds a new line (default behavior).
      if (window.innerWidth > 768) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  return (
    <div className="GroupChat">
      <NewEntry isOpen={isNewEntryOpen} onClose={() => setIsNewEntryOpen(false)} userData={userData} />
      <div className="chat-header">
        <h2>{groupData ? groupData.name : 'Group Chat'}</h2> {/* Restored original header */}
        {groupData && (
          <div className="invite-code-display">
            <span>Invite Code: <strong>{groupData.inviteCode}</strong></span> {/* Restored original invite code display */}
          </div>
        )}
        {/* Removed header button */}
      </div>
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
                  msg.isEntry ? (
                    <div className="entry-message-content">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
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
            placeholder="Click + button to create a new entry or type a message..."
            rows={1}
          />
          <div className="add-entry-btn" onClick={() => setIsNewEntryOpen(true)}>
            <UilPlus />
          </div>
          <button type="submit">Send</button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;