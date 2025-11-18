import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import './GroupChat.css';

const GroupChat = ({ groupId, userData }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dummy = useRef(); // For auto-scrolling

  useEffect(() => {
    if (!groupId) return;

    setLoading(true);
    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
      // Scroll to the bottom after messages are loaded/updated
      dummy.current.scrollIntoView({ behavior: 'smooth' });
    }, (err) => {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

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
      // The dummy ref will scroll down automatically via the onSnapshot listener
    } catch (e) {
      console.error("Error sending message:", e);
      setError("Failed to send message.");
    }
  };

  return (
    <div className="GroupChat">
      <div className="chat-header">
        <h2>Group Chat</h2>
      </div>
      <div className="messages-container">
        {loading && <p>Loading messages...</p>}
        {error && <p className="error-message">{error}</p>}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
            <span className="sender-name">{msg.senderNickname}</span>
            <p>{msg.text}</p>
          </div>
        ))}
        <div ref={dummy}></div>
      </div>
      <form onSubmit={handleSendMessage} className="send-message-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default GroupChat;