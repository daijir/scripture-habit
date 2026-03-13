import React, { useState, useEffect, FC } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { UilEnvelope, UilTrashAlt, UilTimes } from '@iconscout/react-unicons';
import ReactMarkdown from 'react-markdown';
import './LetterBox.css';
import { useLanguage } from '../../Context/LanguageContext';
import { UserData } from '../../types/user';

interface Letter {
    id: string;
    title?: string;
    content?: string;
    createdAt?: Timestamp | any;
}

interface LetterBoxProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData | null;
}

const LetterBox: FC<LetterBoxProps> = ({ isOpen, onClose, userData }) => {
    const { t } = useLanguage();
    const [letters, setLetters] = useState<Letter[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

    useEffect(() => {
        if (!userData || !userData.uid || !isOpen) return;

        const lettersRef = collection(db, 'users', userData.uid, 'letters');
        const q = query(lettersRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedLetters = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Letter));
            setLetters(fetchedLetters);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData, isOpen]);

    const handleDelete = async (e: React.MouseEvent, letterId: string) => {
        e.stopPropagation();
        if (userData?.uid && window.confirm(t('letterBox.deleteConfirm'))) {
            try {
                await deleteDoc(doc(db, 'users', userData.uid, 'letters', letterId));
            } catch (error) {
                console.error("Error deleting letter:", error);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="LetterBoxOverlay" onClick={onClose}>
            <div className="LetterBoxContent" onClick={(e) => e.stopPropagation()}>
                <div className="letterbox-header">
                    <h2><UilEnvelope /> {t('letterBox.title')}</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close"><UilTimes color="#ffffff" /></button>
                </div>

                <div className="letterbox-body">
                    {selectedLetter ? (
                        <div className="letter-detail-view">
                            <button className="back-btn" onClick={() => setSelectedLetter(null)}>
                                &larr; {t('letterBox.back')}
                            </button>
                            <div className="letter-paper">
                                <div className="letter-date">
                                    {selectedLetter.createdAt?.toDate ?
                                        selectedLetter.createdAt.toDate().toLocaleDateString() :
                                        new Date().toLocaleDateString()}
                                </div>
                                <ReactMarkdown>{selectedLetter.content || ""}</ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="letter-list">
                            {loading ? (
                                <p>{t('letterBox.loading')}</p>
                            ) : letters.length === 0 ? (
                                <div className="empty-letters">
                                    <UilEnvelope size="48" color="#ccc" />
                                    <p>{t('letterBox.empty')}</p>
                                </div>
                            ) : (
                                letters.map(letter => (
                                    <div
                                        key={letter.id}
                                        className="letter-item"
                                        onClick={() => setSelectedLetter(letter)}
                                    >
                                        <div className="letter-icon">
                                            <UilEnvelope size="24" color="#8e44ad" />
                                        </div>
                                        <div className="letter-info">
                                            <h3>{letter.title || t('letterBox.defaultTitle')}</h3>
                                            <span className="letter-date-meta">
                                                {letter.createdAt?.toDate ?
                                                    letter.createdAt.toDate().toLocaleDateString() :
                                                    ""}
                                            </span>
                                        </div>
                                        <button
                                            className="delete-letter-btn"
                                            onClick={(e) => handleDelete(e, letter.id)}
                                            aria-label="Delete letter"
                                        >
                                            <UilTrashAlt size="18" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LetterBox;
