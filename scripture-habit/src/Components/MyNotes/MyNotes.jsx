import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilBookOpen, UilSearchAlt, UilAnalysis, UilEnvelope } from '@iconscout/react-unicons';
import NewNote from '../NewNote/NewNote';
import NoteCard from '../NoteCard/NoteCard';
import RecapModal from '../RecapModal/RecapModal'; // Import RecapModal
import LetterBox from '../LetterBox/LetterBox'; // Import LetterBox
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

  const [recapLoading, setRecapLoading] = useState(false);
  const [newNoteInitialData, setNewNoteInitialData] = useState(null);

  // New state for RecapModal
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [generatedRecapText, setGeneratedRecapText] = useState('');

  // New state for LetterBox
  const [isLetterBoxOpen, setIsLetterBoxOpen] = useState(false);

  // State to hold real-time user data
  const [currentUserData, setCurrentUserData] = useState(userData);

  useEffect(() => {
    if (!userData || !userData.uid) return;

    // Listen to the user document specifically for lastRecapGeneratedAt updates
    const userDocRef = doc(db, 'users', userData.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserData({ ...userData, ...docSnap.data() });
      }
    });

    const notesRef = collection(db, 'users', userData.uid, 'notes');
    const q = query(
      notesRef,
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotes = onSnapshot(q, (querySnapshot) => {
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

    return () => {
      unsubscribeUser();
      unsubscribeNotes();
    };
  }, [userData?.uid]); // Only re-run if UID changes

  const handleNoteClick = (note) => {
    setSelectedNote(note);
    setNewNoteInitialData(null);
    setIsEditModalOpen(true);
  };

  const handleGenerateRecap = async () => {
    // Check for rate limiting (6 days)
    if (currentUserData?.lastRecapGeneratedAt) {
      const lastGenerated = currentUserData.lastRecapGeneratedAt.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - lastGenerated);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 6) {
        const daysLeft = 6 - diffDays;
        toast.info(t('groupChat.recapRateLimit') + " " + t('groupChat.daysLeft', { days: daysLeft })); // Reusing existing keys or add new if needed
        return;
      }
    }

    setRecapLoading(true);
    toast.info(t('myNotes.generatingRecap'));
    try {
      const response = await axios.post('/api/generate-personal-weekly-recap', {
        uid: userData.uid,
        language: language
      });

      if (response.data.recap) {
        setGeneratedRecapText(response.data.recap);
        setIsRecapModalOpen(true); // Open "Letter" modal first
        toast.success(t('myNotes.recapSuccess'));
      } else {
        toast.info(response.data.message || t('myNotes.noNotesForRecap'));
      }
    } catch (error) {
      console.error("Error generating recap:", error);
      toast.error(t('myNotes.recapError'));
    } finally {
      setRecapLoading(false);
    }
  };

  const handleSaveRecapToLetterBox = async () => {
    try {
      const lettersRef = collection(db, 'users', userData.uid, 'letters');

      // Extract a simple title if possible from the first line or default
      const lines = generatedRecapText.split('\n');
      let title = t('letterBox.defaultTitle') || "Weekly Recap";

      // Try to find a title line (e.g. "Title: ...") - Simple heuristic
      const titleLine = lines.find(line => line.toLowerCase().includes('title:') || line.includes('タイトル：'));
      if (titleLine) {
        title = titleLine.replace(/Title:|タイトル：/i, '').replace(/\*/g, '').trim();
      }

      await addDoc(lettersRef, {
        content: generatedRecapText,
        title: title,
        createdAt: serverTimestamp(),
        type: 'weekly_recap'
      });

      // Update the user's last generated timestamp
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        lastRecapGeneratedAt: serverTimestamp()
      });

      setIsRecapModalOpen(false);
      toast.success(t('newNote.successPost') || "Saved to Letter Box!");
      setIsLetterBoxOpen(true); // Open the box to show the new item
    } catch (error) {
      console.error("Error saving to letter box:", error);
      toast.error("Failed to save letter.");
    }
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

  // Calculate if recap can be generated
  let canGenerateRecap = true;
  let daysLeft = 0;

  if (currentUserData?.lastRecapGeneratedAt) {
    const lastGenerated = currentUserData.lastRecapGeneratedAt.toDate();
    const now = new Date();
    const diffTime = Math.abs(now - lastGenerated);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 6) {
      canGenerateRecap = false;
      daysLeft = 6 - diffDays;
    }
  }

  return (
    <div className="MyNotes DashboardContent">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Scripture Habit</h1>
          <p className="welcome-text">{t('myNotes.description')}</p>
        </div>


      </div>



      <div className="share-learning-cta" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>{t('myNotes.weeklyReflectionCall')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            className={`new-note-btn cta-btn ${!canGenerateRecap || notes.length === 0 ? 'disabled-btn' : ''}`}
            onClick={(e) => {
              if (!canGenerateRecap || recapLoading || notes.length === 0) {
                e.preventDefault();
                return;
              }
              handleGenerateRecap();
            }}
            disabled={recapLoading || !canGenerateRecap || notes.length === 0}
            style={{
              background: !canGenerateRecap || notes.length === 0 ? '#e0e0e0' : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: !canGenerateRecap || notes.length === 0 ? '#999' : '#555',
              border: '1px solid #eee',
              cursor: !canGenerateRecap || notes.length === 0 ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: '300px',
              justifyContent: 'center',
              opacity: notes.length === 0 ? 0.6 : 1 // Fade out if no notes
            }}
          >
            <UilAnalysis size="20" />
            {recapLoading ? t('myNotes.loading') :
              !canGenerateRecap && notes.length > 0 ? t('groupChat.daysLeft', { days: daysLeft }) :
                t('myNotes.generateRecap')}
          </button>

          <button
            className="letter-box-btn"
            onClick={() => setIsLetterBoxOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#8e44ad',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '500',
              padding: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <UilEnvelope size="20" />
            {t('letterBox.title')}
          </button>
        </div>
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

      <LetterBox
        isOpen={isLetterBoxOpen}
        onClose={() => setIsLetterBoxOpen(false)}
        userData={currentUserData}
      />

      <RecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        recapText={generatedRecapText}
        onSave={handleSaveRecapToLetterBox}
      />

      <NewNote
        isOpen={isEditModalOpen || isModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsModalOpen(false); // Also close the passed in modal state for new notes
          setSelectedNote(null);
          setNewNoteInitialData(null);
        }}
        userData={userData}
        noteToEdit={selectedNote}
        initialData={newNoteInitialData}
        onDelete={() => setIsDeleteModalOpen(true)}
      />
    </div >
  );
};

export default MyNotes;