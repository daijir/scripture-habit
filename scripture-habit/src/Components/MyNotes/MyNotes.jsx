import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilBookOpen } from '@iconscout/react-unicons';
import NewNote from '../NewNote/NewNote';
import { toast } from 'react-toastify';
import './MyNotes.css';

const MyNotes = ({ userData, isModalOpen, setIsModalOpen }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!userData || !userData.uid) {
      setLoading(false);
      return;
    }

    const notesRef = collection(db, 'users', userData.uid, 'notes');
    const q = query(
      notesRef,
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

  const handleNoteClick = (note) => {
    setSelectedNote(note);
    setIsEditModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNote || !userData.uid) return;

    try {
      await deleteDoc(doc(db, 'users', userData.uid, 'notes', selectedNote.id));
      toast.success("Note deleted successfully");
      setIsDeleteModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedNote(null);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  const formatNoteForDisplay = (text) => {
    if (!text) return '';
    let content = text.replace(/📖 \*\*New Study Note\*\*\n+/, '')
      .replace(/📖 \*\*New Study Entry\*\*\n+/, '');

    const chapterMatch = content.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = content.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
      const chapter = chapterMatch[1].trim();
      const scripture = scriptureMatch[1].trim();
      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const maxEnd = Math.max(chapterEnd, scriptureEnd);

      const comment = content.substring(maxEnd).trim();

      return `**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;
    }

    return content;
  };

  return (
    <div className="MyNotes DashboardContent">
      <div className="dashboard-header">
        <div>
          <h1>My Notes</h1>
          <p className="welcome-text">Your personal collection of study notes and reflections.</p>
        </div>
        <button className="new-note-btn" onClick={() => setIsModalOpen(true)}>
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
            <div key={note.id} className="note-card" onClick={() => handleNoteClick(note)} style={{ cursor: 'pointer' }}>
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
                  {formatNoteForDisplay(note.text)}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="ModalOverlay" onClick={() => setIsDeleteModalOpen(false)} style={{ zIndex: 1100 }}>
          <div className="ModalContent delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Note?</h3>
            <p>Are you sure you want to delete this note? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="delete-confirm-btn" onClick={confirmDelete}>Delete Note</button>
            </div>
          </div>
        </div>
      )}

      <NewNote
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedNote(null);
        }}
        userData={userData}
        noteToEdit={selectedNote}
        onDelete={() => setIsDeleteModalOpen(true)}
      />
    </div>
  );
};

export default MyNotes;