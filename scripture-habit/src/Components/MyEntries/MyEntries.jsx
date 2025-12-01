import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import Button from '../Button/Button';
import './MyEntries.css';

const MyEntries = ({ userData, setIsModalOpen }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!userData || !userData.groupId) {
        setLoading(false);
        return;
      }
      // ... (rest of fetch logic remains same, I'm just updating the top part and return)

      try {
        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
        // Query for messages sent by current user that are marked as entries
        const q = query(
          messagesRef, 
          where('senderId', '==', userData.uid), 
          where('isEntry', '==', true),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedEntries = [];
        querySnapshot.forEach((doc) => {
          fetchedEntries.push({ id: doc.id, ...doc.data() });
        });

        setEntries(fetchedEntries);
      } catch (err) {
        console.error("Error fetching entries:", err);
        // Handle index requirement error gracefully
        if (err.code === 'failed-precondition') {
             setError("Requires an index. Please check console for link to create it.");
        } else {
             setError("Failed to load entries.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [userData]);

  if (loading) return <div className="MyEntries loading">Loading entries...</div>;
  if (error) return <div className="MyEntries error">{error}</div>;

  return (
    <div className="MyEntries">
      <div className="entries-header-container">
        <h1>My Entries</h1>
        <Button onClick={() => setIsModalOpen(true)} className="new-entry-btn">
          + New Entry
        </Button>
      </div>
      <div className="entries-grid">
        {entries.length === 0 ? (
          <p className="no-entries">No entries found. Start by creating a new entry!</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="entry-card">
              <div className="entry-date">
                {entry.createdAt?.toDate().toLocaleDateString() || 'Unknown Date'}
              </div>
              <div className="entry-content">
                <ReactMarkdown>
                  {entry.text
                    .replace('📖 **New Study Entry**\n\n', '')
                    .replace(/\n\*\*Scripture:\*\*/g, '\n\n**Scripture:**')}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyEntries;