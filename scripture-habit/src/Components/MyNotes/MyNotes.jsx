import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilBookOpen } from '@iconscout/react-unicons';
import NewNote from '../NewNote/NewNote';
import { toast } from 'react-toastify';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import './MyNotes.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';

const MyNotes = ({ userData, isModalOpen, setIsModalOpen }) => {
  const { language, t } = useLanguage();
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

  const formatNoteForDisplay = (text) => {
    if (!text) return '';
    let content = text.replace(/📖 \*\*New Study Note\*\*\n+/, '')
      .replace(/📖 \*\*New Study Entry\*\*\n+/, '');

    const chapterMatch = content.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = content.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
      const chapter = translateChapterField(chapterMatch[1].trim(), language);
      const rawScripture = scriptureMatch[1].trim();
      const scriptureMap = { 'Old Testament': 'scriptures.oldTestament', 'New Testament': 'scriptures.newTestament', 'Book of Mormon': 'scriptures.bookOfMormon', 'Doctrine and Covenants': 'scriptures.doctrineAndCovenants', 'Pearl of Great Price': 'scriptures.pearlOfGreatPrice', 'General Conference': 'scriptures.generalConference' };
      const scripture = scriptureMap[rawScripture] ? t(scriptureMap[rawScripture]) : rawScripture;
      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const maxEnd = Math.max(chapterEnd, scriptureEnd);

      const comment = content.substring(maxEnd).trim();

      const gcVariants = ['General Conference', '総大会', 'Conferência Geral', '總會大會', 'Conferencia General', 'Đại Hội Trung Ương', 'การประชุมใหญ่สามัญ', '연차 대회', 'Pangkalahatang Kumperensya', 'Mkutano Mkuu'];
      const chapterLabel = gcVariants.includes(rawScripture) ? t('noteLabels.talk') : t('noteLabels.chapter');

      return `**${t('noteLabels.scripture')}:** ${scripture}\n\n**${chapterLabel}:** ${chapter}\n\n${comment}`;
    }

    return content;
  };

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
          {notes.map((note) => (
            <div key={note.id} className="note-card" onClick={() => handleNoteClick(note)} style={{ cursor: 'pointer' }}>
              <div className="note-header">
                <span className="note-date">
                  {note.createdAt?.toDate().toLocaleDateString('en-CA')}
                </span>
              </div>
              <div className="note-content-preview">
                <ReactMarkdown>
                  {formatNoteForDisplay(note.text)}
                </ReactMarkdown>
              </div>
              {getGospelLibraryUrl(note.scripture, note.chapter, language) && (
                <a
                  href={getGospelLibraryUrl(note.scripture, note.chapter, language)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'block',
                    marginTop: '10px',
                    fontSize: '0.8rem',
                    color: 'var(--gray)',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: '100%'
                  }}
                >
                  📖 {t('myNotes.readInGospelLibrary')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {isDeleteModalOpen && (
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