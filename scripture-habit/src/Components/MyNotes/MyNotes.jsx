import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
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
      const scriptureMap = { 'Old Testament': 'scriptures.oldTestament', 'New Testament': 'scriptures.newTestament', 'Book of Mormon': 'scriptures.bookOfMormon', 'Doctrine and Covenants': 'scriptures.doctrineAndCovenants', 'Pearl of Great Price': 'scriptures.pearlOfGreatPrice' };
      const scripture = scriptureMap[rawScripture] ? t(scriptureMap[rawScripture]) : rawScripture;
      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const maxEnd = Math.max(chapterEnd, scriptureEnd);

      const comment = content.substring(maxEnd).trim();

      return `**${t('noteLabels.scripture')}:** ${scripture}\n\n**${t('noteLabels.chapter')}:** ${chapter}\n\n${comment}`;
    }

    return content;
  };

  return (
    <div className="MyNotes DashboardContent">
      <div className="dashboard-header">
        <div>
          <h1>{t('myNotes.title')}</h1>
          <p className="welcome-text">{t('myNotes.description')}</p>
        </div>
      </div>

      <div className="inspiration-section" style={{ marginBottom: '2rem' }}>
        <div className="inspiration-card">
          <h3 className="inspiration-title">{t('dashboard.inspirationTitle')}</h3>
          <blockquote className="inspiration-quote">
            {t('dashboard.inspirationQuote')}
          </blockquote>
          <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>
          <p className="inspiration-message">{t('dashboard.inspirationMessage')}</p>
          <p className="inspiration-from">{t('dashboard.inspirationFrom')}</p>
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
                    display: 'inline-block',
                    marginTop: '10px',
                    fontSize: '0.8rem',
                    color: 'var(--gray)',
                    textDecoration: 'none',
                    fontWeight: 'bold'
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