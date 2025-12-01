import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
// import { UilPlus } from '@iconscout/react-unicons'; // Removed Plus icon import
import './GroupChat.css';

// Removed openNewEntryModal from props
const GroupChat = ({ groupId, userData }) => { 
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null); // Ref for the container

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !userData) return;

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    try {
      await addDoc(messagesRef, {
        text: newMessage,
        createdAt: serverTimestamp(),
        senderId: userData.uid, // Assuming userData has uid
        senderNickname: userData.nickname,
      });
      setNewMessage('');
    } catch (e) {
      console.error("Error sending message:", e);
      toast.error(`Failed to send message: ${e.message || e}`);
    }
  };

  return (
    <div className="GroupChat">
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
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;