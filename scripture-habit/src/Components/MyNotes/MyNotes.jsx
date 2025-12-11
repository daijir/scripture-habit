import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilBookOpen, UilSearchAlt } from '@iconscout/react-unicons';
import NewNote from '../NewNote/NewNote';
import NoteCard from '../NoteCard/NoteCard';
import { toast } from 'react-toastify';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import './MyNotes.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import NoteDisplay from '../NoteDisplay/NoteDisplay';

const MyNotes = ({ userData, isModalOpen, setIsModalOpen }) => {
  const { language, t } = useLanguage();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
      // If note was shared to groups, delete those messages too
      if (selectedNote.sharedMessageIds && Object.keys(selectedNote.sharedMessageIds).length > 0) {
        for (const [groupId, messageId] of Object.entries(selectedNote.sharedMessageIds)) {
          try {
            const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
            await deleteDoc(messageRef);

            // Decrement message count
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
              messageCount: increment(-1)
            });
          } catch (err) {
            console.log(`Could not delete message ${messageId} from group ${groupId}:`, err);
          }
        }
      }

      // Delete the personal note
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



  const filteredNotes = notes.filter(note => {
    const matchesSearch = (note.text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.chapter || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || note.scripture === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="MyNotes DashboardContent">
      <div className="dashboard-header">
        <div>
          <h1>Scripture Habit</h1>
          <p className="welcome-text">{t('myNotes.description')}</p>
        </div>
      </div>



      <div className="share-learning-cta" style={{ marginBottom: '2rem' }}>
        <p>{t('dashboard.shareLearningCall')}</p>
        <button className="new-note-btn cta-btn" onClick={() => setIsModalOpen(true)}>
          <UilPlus /> {t('dashboard.newNote')}
        </button>
      </div>

      <div className="search-and-filter-container">
        <div className="search-bar-container">
          <UilSearchAlt className="search-icon" size="20" />
          <input
            type="text"
            className="search-input"
            placeholder={t('myNotes.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="category-filters">
          <button
            className={`category-chip ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('All')}
          >
            {t('dashboard.seeAll')}
          </button>
          {['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants', 'Pearl of Great Price', 'General Conference', 'BYU Speeches', 'Other'].map(key => {
            const translationKeyMap = {
              'Old Testament': 'scriptures.oldTestament',
              'New Testament': 'scriptures.newTestament',
              'Book of Mormon': 'scriptures.bookOfMormon',
              'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
              'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
              'General Conference': 'scriptures.generalConference',
              'BYU Speeches': 'scriptures.byuSpeeches',
              'Other': 'scriptures.other'
            };
            return (
              <button
                key={key}
                className={`category-chip ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(key)}
              >
                {t(translationKeyMap[key])}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">{t('myNotes.loading')}</div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <UilBookOpen size="60" color="#ccc" />
          <h3>{t('myNotes.noNotesTitle')}</h3>
          <p>{t('myNotes.noNotesDesc')}</p>
        </div>
      ) : (
        <div className="notes-grid">
          {filteredNotes.length === 0 && notes.length > 0 ? (
            <div className="no-results" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '2rem' }}>
              {t('dashboard.noRecentNotes')}
            </div>
          ) : filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isEditable={true}
              onClick={handleNoteClick}
              className="my-notes-card"
            />
          ))}
        </div>
      )
      }

      {
        isDeleteModalOpen && (
          <div className="ModalOverlay" onClick={() => setIsDeleteModalOpen(false)} style={{ zIndex: 1100 }}>
            <div className="ModalContent delete-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t('myNotes.deleteTitle')}</h3>
              <p>{t('myNotes.deleteConfirm')}</p>
              {selectedNote?.sharedMessageIds && Object.keys(selectedNote.sharedMessageIds).length > 0 && (
                <p style={{ color: '#ff9800', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  ⚠️ {t('groupChat.deleteNoteWarning')}
                </p>
              )}
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setIsDeleteModalOpen(false)}>{t('myNotes.cancel')}</button>
                <button className="delete-confirm-btn" onClick={confirmDelete}>{t('myNotes.delete')}</button>
              </div>
            </div>
          </div>
        )
      }

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
    </div >
  );
};

export default MyNotes;