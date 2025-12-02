import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilBookOpen } from '@iconscout/react-unicons';
import './MyNotes.css'; 

const MyNotes = ({ userData, isModalOpen, setIsModalOpen }) => { 
  const [notes, setNotes] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData || !userData.groupId || !userData.uid) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
    const q = query(
      messagesRef,
      where('senderId', '==', userData.uid),
      where('isNote', '==', true), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedNotes = [];
      querySnapshot.forEach((doc) => {
        fetchedNotes.push({ id: doc.id, ...doc.data() });
      });
      setNotes(fetchedNotes);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  return (
    <div className="MyNotes DashboardContent"> 
      <div className="dashboard-header">
        <div>
          <h1>My Notes</h1> 
          <p className="welcome-text">Your personal collection of study notes and reflections.</p> 
        </div>
        <button className="new-note-btn" onClick={() => setIsModalOpen(true)}> {/* Renamed class */}
          <UilPlus /> New Note
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <UilBookOpen size="60" color="#ccc" />
          <h3>No notes yet</h3>
          <p>Start your journey by creating your first study note.</p>
        </div>
      ) : (
        <div className="notes-grid"> 
          {notes.map((note) => (
            <div key={note.id} className="note-card"> 
              <div className="note-header">
                <span className="note-date">
                  {note.createdAt?.toDate().toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="note-content-preview">
                <ReactMarkdown>
                    {note.text
                        .replace('📖 **New Study Note**\n\n', '') 
                        .replace('📖 **New Study Entry**\n\n', '') 
                        .replace(/\n\*\*Scripture:\*\*/g, '\n\n**Scripture:**')}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyNotes;