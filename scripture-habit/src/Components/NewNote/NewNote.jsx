import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment, query, where, getDocs, Timestamp, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UilTrashAlt, UilShuffle } from '@iconscout/react-unicons';
import Select from 'react-select';
import { ScripturesOptions } from '../../Data/Data';
import { MasteryScriptures } from '../../Data/MasteryScriptures';
import { PeaceScriptures } from '../../Data/PeaceScriptures';
import { AdversityScriptures } from '../../Data/AdversityScriptures';
import { RelationshipScriptures } from '../../Data/RelationshipScriptures';
import { JoyScriptures } from '../../Data/JoyScriptures';
import Input from '../Input/Input';
import './NewNote.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import { removeNoteHeader } from '../../Utils/noteUtils';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import { localizeLdsUrl } from '../../Utils/urlLocalizer';
import { UilBookOpen } from '@iconscout/react-unicons';
import { useGCMetadata } from '../../hooks/useGCMetadata';
import confetti from 'canvas-confetti';

const NewNote = ({ isOpen, onClose, userData, noteToEdit, onDelete, userGroups = [], isGroupContext = false, currentGroupId = null, initialData = null }) => {
    const { t, language } = useLanguage();

    const [chapter, setChapter] = useState('');
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [comment, setComment] = useState('');
    const [aiQuestion, setAiQuestion] = useState('');

    // New sharing states
    const [shareOption, setShareOption] = useState('all'); // 'all', 'specific', 'none', 'current'
    const [selectedShareGroups, setSelectedShareGroups] = useState([]);

    // Fetch metadata for GC/Other URLs
    const isUrl = chapter && (chapter.startsWith('http') || chapter.includes('churchofjesuschrist.org'));
    const { data: gcMeta, loading: gcLoading } = useGCMetadata(isUrl ? chapter : null, language);

    // Randomized placeholders state
    const [currentChapterPlaceholder, setCurrentChapterPlaceholder] = useState('');
    const [currentCommentPlaceholder, setCurrentCommentPlaceholder] = useState('');



    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastAiResponse, setLastAiResponse] = useState('');
    const [showScriptureSelectionModal, setShowScriptureSelectionModal] = useState(false);
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [availableReadingPlanScripts, setAvailableReadingPlanScripts] = useState([]);

    const getTranslatedScriptureLabel = (value) => {
        switch (value) {
            case "Old Testament": return t('scriptures.oldTestament');
            case "New Testament": return t('scriptures.newTestament');
            case "Book of Mormon": return t('scriptures.bookOfMormon');
            case "Doctrine and Covenants": return t('scriptures.doctrineAndCovenants');
            case "Pearl of Great Price": return t('scriptures.pearlOfGreatPrice');
            case "Ordinances and Proclamations": return t('scriptures.ordinancesAndProclamations');
            case "General Conference": return t('scriptures.generalConference');
            case "BYU Speeches": return t('scriptures.byuSpeeches');
            case "Other": return t('scriptures.other');
            default: return value;
        }
    };

    const translatedScripturesOptions = ScripturesOptions.map(option => ({
        ...option,
        label: getTranslatedScriptureLabel(option.value)
    }));

    useEffect(() => {
        if (isOpen) {
            const rawChapterPh = t('newNote.chapterPlaceholder');
            setCurrentChapterPlaceholder(Array.isArray(rawChapterPh) ? rawChapterPh[Math.floor(Math.random() * rawChapterPh.length)] : rawChapterPh);

            const rawCommentPh = t('newNote.commentPlaceholder');
            setCurrentCommentPlaceholder(Array.isArray(rawCommentPh) ? rawCommentPh[Math.floor(Math.random() * rawCommentPh.length)] : rawCommentPh);
        }
    }, [isOpen, language, t]);

    useEffect(() => {
        if (isOpen && noteToEdit) {
            setLastAiResponse('');
            let text = removeNoteHeader(noteToEdit.text || '');

            const chapterMatch = text.match(/\*\*(?:Chapter|Title|Speech):\*\* (.*?)(?:\n|$)/);
            const chap = chapterMatch ? chapterMatch[1].trim() : '';

            const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
            const script = scriptureMatch ? scriptureMatch[1].trim() : '';

            let comm = text;
            let maxIndex = 0;

            if (scriptureMatch) {
                const end = scriptureMatch.index + scriptureMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }
            if (chapterMatch) {
                const end = chapterMatch.index + chapterMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }

            if (maxIndex > 0) {
                comm = text.substring(maxIndex).trim();
            }

            setChapter(chap);
            setScripture(script);
            setComment(comm);

            const option = translatedScripturesOptions.find(opt => opt.value.toLowerCase() === script.toLowerCase());
            setSelectedOption(option || null);

            setShareOption('none');
            setSelectedShareGroups([]);

        } else if (isOpen && !noteToEdit) {
            setLastAiResponse('');

            // Check for initialData
            if (initialData) {
                setChapter(initialData.chapter || '');
                setScripture(initialData.scripture || '');
                setComment(initialData.comment || '');

                if (initialData.scripture) {
                    const option = translatedScripturesOptions.find(opt => opt.value.toLowerCase() === initialData.scripture.toLowerCase());
                    setSelectedOption(option || null);
                } else {
                    setSelectedOption(null);
                }
            } else {
                setChapter('');
                setScripture('');
                setComment('');
                setAiQuestion('');
                setSelectedOption(null);
            }

            // Default sharing option logic
            if (isGroupContext) {
                setShareOption('current');
            } else {
                setShareOption(userGroups.length > 0 ? 'all' : 'none');
            }
            setSelectedShareGroups([]);
        }
    }, [isOpen, noteToEdit, userGroups.length, isGroupContext, initialData]); // Removed translatedScripturesOptions from dependency to avoid loop if not memoized, though t() change triggers re-render anyway.

    const handleGroupSelection = (groupId) => {
        setSelectedShareGroups(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
    };

    if (!isOpen) return null;

    if (!isOpen) return null;

    const handleGenerateQuestions = async () => {
        if (!scripture || !chapter) {
            toast.warning(t('newNote.errorMissingFields'));
            return;
        }

        setAiLoading(true);
        try {
            // Determine API URL based on environment (Vercel vs Local)
            // Vite proxy should handle /api/ requests if configured, or if served from same origin.
            // In dev, usually http://localhost:5000/api/... but we rely on relative path if proxy is set.
            // If running via `vite` and `npm run server` separately without proxy, this might fail on CORS or 404.
            // Existing app likely uses direct Firebase calls mostly. 
            // The user added backend/index.js recently.
            // Let's assume relative path works (Vercel convention).


            const apiUrl = Capacitor.isNativePlatform()
                ? 'https://scripture-habit.vercel.app/api/generate-ponder-questions'
                : '/api/generate-ponder-questions';

            const response = await axios.post(apiUrl, {
                scripture: selectedOption?.label || scripture,
                chapter,
                language
            });

            if (response.data.questions) {
                const newContent = response.data.questions;
                setAiQuestion(newContent);
                toast.success('AI Ponder Questions generated!');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate questions. Gemini API key might be missing.');
        } finally {
            setAiLoading(false);
        }
    };



    const handleSurpriseMe = () => {
        setShowRandomMenu(true);
    };

    const handlePickRandomMastery = () => {
        const randomIndex = Math.floor(Math.random() * MasteryScriptures.length);
        const randomScripture = MasteryScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomPeace = () => {
        const randomIndex = Math.floor(Math.random() * PeaceScriptures.length);
        const randomScripture = PeaceScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomAdversity = () => {
        const randomIndex = Math.floor(Math.random() * AdversityScriptures.length);
        const randomScripture = AdversityScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomRelationship = () => {
        const randomIndex = Math.floor(Math.random() * RelationshipScriptures.length);
        const randomScripture = RelationshipScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomJoy = () => {
        const randomIndex = Math.floor(Math.random() * JoyScriptures.length);
        const randomScripture = JoyScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const pickAndFillRandom = (randomScripture) => {
        // Find the option that matches the category
        const option = translatedScripturesOptions.find(opt => opt.value === randomScripture.scripture);

        if (option) {
            setSelectedOption(option);
            setScripture(randomScripture.scripture);

            let finalChapter = randomScripture.chapter;

            // If it's a URL, localize it
            if (finalChapter.startsWith('http')) {
                finalChapter = localizeLdsUrl(finalChapter, language);
            } else {
                // Otherwise translate as a normal chapter (e.g. Proverbs 3:5-6 -> 箴言 3:5-6)
                finalChapter = translateChapterField(finalChapter, language);
            }

            setChapter(finalChapter);
        }
    };



    const fillScriptureData = (script) => {
        let category = 'Other';
        let chapterVal = script;

        // Special handling for 2025 D&C Year
        if (script.includes("Official Declarations")) {
            category = "Doctrine and Covenants";
            // Check for translations
            const odTranslations = {
                ja: "公式の宣言",
                pt: "Declarações Oficiais",
                zho: "正式宣言",
                es: "Declaraciones Oficiales",
                vi: "Tuyên Ngôn Chính Thức",
                th: "คำประกาศอย่างเป็นทางการ",
                ko: "공식 선언",
                tl: "Opisyal na Pahayag",
                sw: "Matamko Rasmi"
            };
            if (odTranslations[language]) {
                chapterVal = script.replace("Official Declarations", odTranslations[language]);
            }
        } else if (script.includes("Doctrine and Covenants")) {
            category = "Doctrine and Covenants";
            // e.g. "Doctrine and Covenants 1" -> "1"
            const match = script.match(/Doctrine and Covenants\s+(.*)/);
            if (match) {
                chapterVal = match[1]; // Just the section number
            }
        } else if (script.includes("Joseph Smith—History") || script.includes("Joseph Smith-History")) {
            category = "Pearl of Great Price";
            // Keep full string but maybe translate "Joseph Smith—History" if needed?
            // Usually standard books handle themselves or user can edit. 
            // Let's pass the string as is or if we want to be fancy:
            const jshTranslations = {
                ja: "ジョセフ・スミスー歴史"
            };
            if (jshTranslations[language]) {
                chapterVal = script.replace(/Joseph Smith[—-]History/, jshTranslations[language]);
            }
        } else if (script.includes("Articles of Faith")) {
            category = "Pearl of Great Price";
            const aofTranslations = {
                ja: "信仰箇条",
                pt: "Regras de Fé",
                zho: "信條",
                es: "Artículos de Fe",
                vi: "Những Tín Điều",
                th: "หลักแห่งความเชื่อ",
                ko: "신앙개조",
                tl: "Mga Saligan ng Pananampalataya",
                sw: "Makala ya Imani"
            };
            if (aofTranslations[language]) {
                chapterVal = script.replace("Articles of Faith", aofTranslations[language]);
            }
        } else if (script.includes("The Family: A Proclamation") || script.includes("The Living Christ") || script.includes("The Restoration")) {
            category = "Ordinances and Proclamations";

            // Translations map
            const opTranslations = {
                "The Family: A Proclamation to the World": {
                    ja: "家族：世界への宣言",
                    pt: "A Família: Proclamação ao Mundo",
                    zho: "家庭：致全世界文告",
                    es: "La Familia: Una Proclamación para el Mundo",
                    vi: "Gia Đình: Bản Tuyên Ngôn gửi cho Thế Giới",
                    th: "ครอบครัว: ถ้อยแถลงต่อโลก",
                    ko: "가족: 세상에 전하는 선언문",
                    tl: "Ang Mag-anak: Isang Pagpapahayag sa Mundo",
                    sw: "Familia: Tangazo kwa Ulimwengu"
                },
                "The Living Christ: The Testimony of the Apostles": {
                    ja: "生けるキリスト：使徒たちの証",
                    pt: "O Cristo Vivo: O Testemunho dos Apóstolos",
                    zho: "活著的基督：使徒的見證",
                    es: "El Cristo Viviente: El Testimonio de los Apóstoles",
                    vi: "Đấng Ky Tô Sống: Chứng Ngôn của Các Vị Sứ Đồ",
                    th: "พระคริสต์ที่ทรงพระชนม์: คำพยานของอัครสาวก",
                    ko: "살아 계신 그리스도: 사도들의 간증",
                    tl: "Ang Buhay na Cristo: Ang Patotoo ng mga Apostol",
                    sw: "Kristo Aliye Hai: Ushuhuda wa Mitume"
                },
                "The Restoration of the Fulness of the Gospel of Jesus Christ: A Bicentennial Proclamation to the World": {
                    ja: "イエス・キリストの福音の満ちみちた回復：世界への宣言200周年",
                    pt: "A Restauração da Plenitude do Evangelho de Jesus Cristo: Uma Proclamação Bicentenária ao Mundo",
                    zho: "耶穌基督福音的復興：兩百週年致全世界文告",
                    es: "La Restauración de la plenitud del evangelio de Jesucristo: Una proclamación para el mundo en el bicentenario",
                    vi: "Sự Phục Hồi Trọn Vẹn Phúc Âm của Chúa Giê Su Ky Tô: Bản Tuyên Ngôn Kỷ Niệm Hai Trăm Năm Gửi cho Thế Giới",
                    th: "การฟื้นฟูความสมบูรณ์ของพระกิตติคุณของพระเยซูคริสต์: ถ้อยแถลงในวาระครบสองศตวรรษต่อโลก",
                    ko: "예수 그리스도 복음의 충만함의 회복: 세상에 전하는 이백주년 선언문",
                    tl: "Ang Pagapanumbalik ng Kabuuan ng Ebanghelyo ni Jesucristo: Isang Pagpapahayag sa Mundo sa Ika-200 Anibersaryo",
                    sw: "Urejesho wa Utimilifu wa Injili ya Yesu Kristo: Tangazo la Miaka Mia Mbili kwa Ulimwengu"
                },
                // Short versions for robustness
                "The Living Christ": {
                    ja: "生けるキリスト",
                    pt: "O Cristo Vivo",
                    zho: "活著的基督",
                    es: "El Cristo Viviente",
                    vi: "Đấng Ky Tô Sống",
                    th: "พระคริสต์ที่ทรงพระชนม์",
                    ko: "살아 계신 그리스도",
                    tl: "Ang Buhay na Cristo",
                    sw: "Kristo Aliye Hai"
                },
                "The Restoration": {
                    ja: "回復の宣言",
                    pt: "A Restauração",
                    zho: "復興宣文",
                    es: "La Restauración",
                    vi: "Sự Phục Hồi",
                    th: "การฟื้นฟู",
                    ko: "회복 선언문",
                    tl: "Ang Pagapanumbalik",
                    sw: "Urejesho"
                }
            };

            // Logic to replace keeping verses
            // 1. Check Long Restoration
            const restorationLong = "The Restoration of the Fulness of the Gospel of Jesus Christ: A Bicentennial Proclamation to the World";
            if (script.includes(restorationLong)) {
                if (opTranslations[restorationLong][language]) {
                    chapterVal = script.replace(restorationLong, opTranslations[restorationLong][language]);
                } else if (opTranslations["The Restoration"][language]) {
                    // Fallback to short translation if long not mapped perfectly
                    chapterVal = script.replace("The Restoration", opTranslations["The Restoration"][language]);
                }
            }
            // 2. Check Living Christ Long
            else if (script.includes("The Living Christ: The Testimony of the Apostles")) {
                const key = "The Living Christ: The Testimony of the Apostles";
                if (opTranslations[key][language]) {
                    chapterVal = script.replace(key, opTranslations[key][language]);
                } else if (opTranslations["The Living Christ"][language]) {
                    chapterVal = script.replace("The Living Christ", opTranslations["The Living Christ"][language]);
                }
            }
            // 3. Check Family Proclamation
            else if (script.includes("The Family: A Proclamation to the World")) {
                const key = "The Family: A Proclamation to the World";
                if (opTranslations[key][language]) {
                    chapterVal = script.replace(key, opTranslations[key][language]);
                }
            }
            // 4. Fallbacks for partial matches
            else if (script.includes("The Restoration")) {
                if (opTranslations["The Restoration"][language]) {
                    chapterVal = script.replace("The Restoration", opTranslations["The Restoration"][language]);
                }
            } else if (script.includes("The Living Christ")) {
                if (opTranslations["The Living Christ"][language]) {
                    chapterVal = script.replace("The Living Christ", opTranslations["The Living Christ"][language]);
                }
            }

        } else {
            // General logic for standard books if they appeared (e.g. Old Testament)
            // But for 2025 it's mostly D&C. 
            // If "The Family: A Proclamation..." -> Category Other, Chapter "The Family..."
            // "Other" is default.
        }

        const option = translatedScripturesOptions.find(opt => opt.value === category);
        if (option) {
            setSelectedOption(option);
            setScripture(category);
            setChapter(chapterVal);
        } else {
            // Should not happen if 'Other' is there
            setScripture('Other');
            setChapter(script);
            setSelectedOption(translatedScripturesOptions.find(opt => opt.value === 'Other'));
        }
    };

    const handleTodaysReading = () => {
        const plan = getTodayReadingPlan();
        if (!plan || !plan.scripts || plan.scripts.length === 0) {
            toast.info(t('dashboard.noReadingPlan'));
            return;
        }

        if (plan.scripts.length > 1) {
            setAvailableReadingPlanScripts(plan.scripts);
            setShowScriptureSelectionModal(true);
            setShowRandomMenu(false);
        } else {
            fillScriptureData(plan.scripts[0]);
            setShowRandomMenu(false);
        }
    };

    const handleSubmit = async () => {
        if (!chapter || !scripture) {
            setError(t('newNote.errorMissingFields'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let messageText;
            if (scripture === "Other") {
                // For "Other" category, don't include Chapter/URL in the display text
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n${comment}`;
            } else {
                let label = "Chapter";
                if (scripture === "BYU Speeches") {
                    label = "Speech";
                }
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**${label}:** ${chapter}\n\n${comment}`;
            }



            if (noteToEdit) {
                if (noteToEdit.groupMessageId && noteToEdit.groupId) {
                    // Editing a message directly from group chat
                    const messageRef = doc(db, 'groups', noteToEdit.groupId, 'messages', noteToEdit.groupMessageId);

                    // First get the message to check for originalNoteId
                    const messageSnap = await getDoc(messageRef);
                    const messageData = messageSnap.exists() ? messageSnap.data() : null;

                    await updateDoc(messageRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        editedAt: serverTimestamp(),
                        isEdited: true
                    });

                    // Sync to personal note if linked
                    if (messageData?.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', messageData.originalNoteId);
                            await updateDoc(noteRef, {
                                text: messageText,
                                scripture: scripture,
                                chapter: chapter,
                                comment: comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else if (isGroupContext) {
                    // Editing an existing note (which is a message in a specific group)
                    const targetGroupId = currentGroupId || userData.groupId;
                    const messageRef = doc(db, 'groups', targetGroupId, 'messages', noteToEdit.id);
                    await updateDoc(messageRef, {
                        text: messageText,
                    });

                    // Try to sync back to personal note if linked
                    if (noteToEdit.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.originalNoteId);
                            await updateDoc(noteRef, {
                                text: messageText,
                                scripture: scripture,
                                chapter: chapter,
                                comment: comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else {
                    // Editing a personal note
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    await updateDoc(noteRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        comment: comment
                    });

                    // SYNC TO GROUPS
                    // 1. Get the list of groups this note was shared with
                    let sharedMessageIds = noteToEdit.sharedMessageIds || {};
                    const groupsToCheck = noteToEdit.sharedWithGroups || [];
                    let idsUpdated = false;

                    for (const groupId of groupsToCheck) {
                        let messageId = sharedMessageIds[groupId];

                        if (!messageId) {
                            // Attempt to find the message in this group
                            try {
                                const messagesRef = collection(db, 'groups', groupId, 'messages');

                                // Strategy A: Check by originalNoteId (for future notes)
                                const qId = query(messagesRef, where('originalNoteId', '==', noteToEdit.id));
                                const snapId = await getDocs(qId);

                                if (!snapId.empty) {
                                    messageId = snapId.docs[0].id;
                                } else {
                                    // Strategy B: Check by content match (for legacy notes)
                                    // We look for a message by this user, that is a note, and has the OLD text
                                    const qText = query(messagesRef,
                                        where('senderId', '==', userData.uid),
                                        where('isNote', '==', true),
                                        where('text', '==', noteToEdit.text)
                                    );
                                    const snapText = await getDocs(qText);
                                    if (!snapText.empty) {
                                        messageId = snapText.docs[0].id;
                                        // Also update the message with originalNoteId for future robustness
                                        await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
                                            originalNoteId: noteToEdit.id
                                        });
                                    } else {
                                        // Strategy C: Check by Timestamp (approximate match)
                                        // Useful if text has been edited separately and they are out of sync
                                        if (noteToEdit.createdAt) {
                                            const noteTime = noteToEdit.createdAt.toDate ? noteToEdit.createdAt.toDate() : new Date(noteToEdit.createdAt.seconds * 1000);
                                            const startTime = new Date(noteTime.getTime() - 60000); // -1 minute
                                            const endTime = new Date(noteTime.getTime() + 60000); // +1 minute

                                            const qTime = query(messagesRef,
                                                where('senderId', '==', userData.uid),
                                                where('isNote', '==', true),
                                                where('createdAt', '>=', startTime),
                                                where('createdAt', '<=', endTime)
                                            );
                                            const snapTime = await getDocs(qTime);
                                            if (!snapTime.empty) {
                                                messageId = snapTime.docs[0].id;
                                                await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
                                                    originalNoteId: noteToEdit.id
                                                });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(`Error finding message in group ${groupId}:`, err);
                            }
                        }

                        if (messageId) {
                            try {
                                const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
                                await updateDoc(msgRef, { text: messageText });
                                sharedMessageIds[groupId] = messageId;
                                idsUpdated = true;
                            } catch (err) {
                                console.error(`Error updating message ${messageId} in group ${groupId}:`, err);
                            }
                        }
                    }

                    // Save the discovered IDs back to the note so we don't have to search next time
                    if (idsUpdated) {
                        await updateDoc(noteRef, { sharedMessageIds });
                    }
                }
                toast.success(t('newNote.successUpdate'));
            } else {
                // Creating a new note
                const userRef = doc(db, 'users', userData.uid);
                const userSnap = await getDoc(userRef);
                const currentUserData = userSnap.data();

                // Streak logic (simplified for brevity, keeping existing logic)
                const timeZone = currentUserData.timeZone || 'UTC';
                const now = new Date();
                const todayStr = now.toLocaleDateString('en-CA', { timeZone });
                let lastPostDate = null;
                if (currentUserData.lastPostDate) {
                    if (typeof currentUserData.lastPostDate.toDate === 'function') {
                        lastPostDate = currentUserData.lastPostDate.toDate();
                    } else {
                        lastPostDate = new Date(currentUserData.lastPostDate);
                    }
                }
                let newStreak = currentUserData.streakCount || 0;
                let streakUpdated = false;

                if (!lastPostDate) {
                    newStreak = 1;
                    streakUpdated = true;
                } else {
                    const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });
                    if (todayStr !== lastPostDateStr) {
                        const todayDate = new Date(todayStr);
                        const lastPostDateObj = new Date(lastPostDateStr);
                        const diffTime = todayDate - lastPostDateObj;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays === 1) {
                            newStreak += 1;
                            streakUpdated = true;
                        } else {
                            newStreak = 1;
                            streakUpdated = true;
                        }
                    } else {
                        if (newStreak === 0) {
                            newStreak = 1;
                            streakUpdated = true;
                        }
                    }
                }

                if (streakUpdated) {
                    await updateDoc(userRef, {
                        streakCount: newStreak,
                        daysStudiedCount: increment(1),
                        lastPostDate: serverTimestamp(),
                        totalNotes: increment(1)
                    });
                } else {
                    await updateDoc(userRef, {
                        lastPostDate: serverTimestamp(),
                        totalNotes: increment(1)
                    });
                }

                // Determine target groups for the note
                let groupsToPostTo = [];
                if (shareOption === 'all') {
                    groupsToPostTo = userGroups.map(g => g.id);
                } else if (shareOption === 'specific') {
                    groupsToPostTo = selectedShareGroups;
                } else if (shareOption === 'current') {
                    const targetId = currentGroupId || userData.groupId;
                    if (targetId) {
                        groupsToPostTo = [targetId];
                    }
                }

                // 1. Create the Personal Note FIRST to get its ID
                const personalNoteRef = await addDoc(collection(db, 'users', userData.uid, 'notes'), {
                    text: messageText,
                    createdAt: serverTimestamp(),
                    scripture: scripture,
                    chapter: chapter,
                    comment: comment,
                    shareOption: shareOption,
                    sharedWithGroups: groupsToPostTo // Store the array of group IDs
                });

                // 2. Post to each target group, linking back to the personal note
                const sharedMessageIds = {};

                // Use explicit timestamp for notes to ensure consistent ordering
                const noteTimestamp = Timestamp.now();

                const postPromises = groupsToPostTo.map(async (gid) => {
                    const messagesRef = collection(db, 'groups', gid, 'messages');
                    const groupRef = doc(db, 'groups', gid);

                    const msgRef = await addDoc(messagesRef, {
                        text: messageText,
                        senderId: userData.uid,
                        senderNickname: userData.nickname,
                        createdAt: noteTimestamp, // Use explicit timestamp
                        isNote: true,
                        originalNoteId: personalNoteRef.id // Link to personal note
                    });

                    // Update group metadata
                    // Update group metadata
                    // Read group first to update dailyActivity
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        const gData = groupSnap.data();
                        const todayStr = new Date().toDateString();
                        const currentActivity = gData.dailyActivity || {};
                        const updatePayload = {
                            messageCount: increment(1),
                            noteCount: increment(1), // Increment note count
                            lastMessageAt: serverTimestamp(),
                            [`memberLastActive.${userData.uid}`]: serverTimestamp()
                        };

                        if (currentActivity.date !== todayStr) {
                            updatePayload.dailyActivity = {
                                date: todayStr,
                                activeMembers: [userData.uid]
                            };
                        } else {
                            const newActiveMembers = [...(currentActivity.activeMembers || [])];
                            if (!newActiveMembers.includes(userData.uid)) {
                                newActiveMembers.push(userData.uid);
                            }
                            updatePayload.dailyActivity = {
                                ...currentActivity,
                                activeMembers: newActiveMembers
                            };
                        }

                        await updateDoc(groupRef, updatePayload);
                    }

                    sharedMessageIds[gid] = msgRef.id;
                });

                await Promise.all(postPromises);

                // 3. Update the Personal Note with the IDs of the shared messages
                if (Object.keys(sharedMessageIds).length > 0) {
                    await updateDoc(personalNoteRef, { sharedMessageIds });
                }

                // Send streak announcement AFTER note is posted
                // Use explicit timestamp that is 2 seconds AFTER the note timestamp
                if (streakUpdated && newStreak > 0) {
                    // Create announcement timestamp 2 seconds after note
                    const announcementTimestamp = Timestamp.fromMillis(noteTimestamp.toMillis() + 2000);

                    const targetGroupIds = userGroups.map(g => g.id);
                    for (const gid of targetGroupIds) {
                        const messagesRef = collection(db, 'groups', gid, 'messages');
                        await addDoc(messagesRef, {
                            text: t('groupChat.streakAnnouncement', { nickname: userData.nickname, streak: newStreak }),
                            senderId: 'system',
                            senderNickname: 'Scripture Habit Bot',
                            createdAt: announcementTimestamp, // Explicit timestamp 2 seconds after note
                            isSystemMessage: true,
                            messageType: 'streakAnnouncement',
                            messageData: {
                                nickname: userData.nickname,
                                userId: userData.uid,
                                streak: newStreak
                            }
                        });
                    }
                }

                toast.success(t('newNote.successPost'));

                // Handle Level Up Celebration
                const currentDays = currentUserData.daysStudiedCount || 0;
                const willLevelUp = streakUpdated && (currentDays + 1) % 7 === 0;

                if (willLevelUp) {
                    const newLevel = Math.floor((currentDays + 1) / 7) + 1;
                    toast.success(`🎊 Congratulations! You reached Level ${newLevel}! 🎊`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    });

                    // Level up confetti (bigger blast)
                    const duration = 5 * 1000;
                    const animationEnd = Date.now() + duration;
                    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

                    const randomInRange = (min, max) => Math.random() * (max - min) + min;

                    const interval = setInterval(function () {
                        const timeLeft = animationEnd - Date.now();

                        if (timeLeft <= 0) {
                            return clearInterval(interval);
                        }

                        const particleCount = 50 * (timeLeft / duration);
                        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
                    }, 250);
                } else {
                    // Normal note confetti
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            }

            setLoading(false);
            onClose();
            setChapter('');
            setScripture('');
            setComment('');

        } catch (e) {
            console.error("Error saving note:", e);
            setError(t('newNote.errorSave'));
            setLoading(false);
        }
    };

    if (showRandomMenu) {
        return (
            <div className="ModalOverlay" onClick={onClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="modal-header" style={{ justifyContent: 'center' }}>
                        <h1>{t('newNote.surpriseMe')}</h1>
                    </div>
                    <p style={{ marginBottom: '1.5rem', color: '#666' }}>{t('newNote.chooseScripturePlaceholder')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '0.5rem' }}>
                        <button
                            onClick={handleTodaysReading}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>📅</span>
                            {t('dashboard.todaysComeFollowMe')}
                        </button>

                        <button
                            onClick={handlePickRandomMastery}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🎓</span>
                            {t('newNote.masteryScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomPeace}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🕊️</span>
                            {t('newNote.peaceScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomAdversity}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>⛓️</span>
                            {t('newNote.adversityScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomRelationship}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🤝</span>
                            {t('newNote.relationshipScriptures')}
                        </button>
                        <button
                            onClick={handlePickRandomJoy}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>😊</span>
                            {t('newNote.joyScriptures')}
                        </button>
                    </div>
                    <button
                        onClick={() => setShowRandomMenu(false)}
                        className="cancel-btn"
                        style={{ marginTop: '2rem', alignSelf: 'center', width: 'auto', background: '#e2e8f0', color: '#4a5568' }}
                    >
                        {t('newNote.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    if (showScriptureSelectionModal) {
        return (
            <div className="ModalOverlay" onClick={onClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="modal-header" style={{ justifyContent: 'center' }}>
                        <h1>{t('dashboard.todaysComeFollowMe')}</h1>
                    </div>
                    <p style={{ marginBottom: '1rem', color: '#666' }}>{t('newNote.chooseScripturePlaceholder')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', overflowY: 'auto', padding: '0.5rem' }}>
                        {availableReadingPlanScripts.map((script, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    fillScriptureData(script);
                                    setShowScriptureSelectionModal(false);
                                }}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    color: '#2d3748',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = '#b794f4'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                📖 {script}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowScriptureSelectionModal(false)}
                        className="cancel-btn"
                        style={{ marginTop: '1.5rem', alignSelf: 'center', width: 'auto', background: '#e2e8f0', color: '#4a5568' }}
                    >
                        {t('newNote.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ModalOverlay" onClick={onClose}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h1>{noteToEdit ? t('newNote.editTitle') : t('newNote.newTitle')}</h1>
                    {noteToEdit && (
                        <button
                            className="delete-btn"
                            onClick={onDelete}
                            title={t('newNote.deleteTitle')}
                        >
                            <UilTrashAlt size="24" />
                        </button>
                    )}
                </div>
                {error && <p className="error-message">{error}</p>}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label htmlFor="scripture-select" className="modal-label" style={{ marginBottom: 0 }}>{t('newNote.chooseScriptureLabel')}</label>
                    </div>
                    <Select
                        options={translatedScripturesOptions}
                        onChange={(option) => {
                            setSelectedOption(option);
                            setScripture(option?.value);
                        }}
                        value={selectedOption}
                        placeholder={t('newNote.chooseScripturePlaceholder')}
                        styles={{
                            control: (base) => ({
                                ...base,
                                backgroundColor: '#ffffff',
                                borderColor: 'rgba(0, 0, 0, 0.05)',
                                borderWidth: '2px',
                                borderRadius: '0.5rem',
                                padding: '0.2rem',
                                color: '#333',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            }),
                            placeholder: (base) => ({
                                ...base,
                                color: '#999',
                            }),
                            singleValue: (base) => ({
                                ...base,
                                color: '#333',
                            }),
                            input: (base) => ({
                                ...base,
                                color: '#333',
                            }),
                            menu: (base) => ({
                                ...base,
                                zIndex: 100,
                                backgroundColor: '#ffffff',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                borderRadius: '0.5rem',
                            }),
                            option: (base, { isFocused, isSelected }) => ({
                                ...base,
                                backgroundColor: isSelected ? 'var(--pink)' : isFocused ? 'rgba(255, 145, 157, 0.1)' : 'transparent',
                                color: isSelected ? 'white' : '#333',
                                cursor: 'pointer',
                                '&:active': {
                                    backgroundColor: 'var(--pink)',
                                    color: 'white',
                                },
                            })
                        }}
                    />
                </div>

                <Input
                    label={scripture === "General Conference" ? t('newNote.urlLabel') : (scripture === "BYU Speeches" ? t('newNote.byuUrlLabel') : (scripture === "Other" ? t('newNote.otherUrlLabel') : t('newNote.chapterLabel')))}
                    type="text"
                    value={chapter}
                    onChange={(e) => {
                        let val = e.target.value;
                        setChapter(val);
                    }}
                    required
                    placeholder={scripture === "General Conference" ? t('newNote.urlPlaceholder') : (scripture === "BYU Speeches" ? t('newNote.byuUrlPlaceholder') : (scripture === "Other" ? t('newNote.otherUrlPlaceholder') : currentChapterPlaceholder))}
                />

                {!noteToEdit && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={handleSurpriseMe}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                padding: '0.3rem 0.8rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                            }}
                        >
                            <UilShuffle size="16" /> {t('newNote.surpriseMe')}
                        </button>
                    </div>
                )}

                {isUrl && (gcLoading || gcMeta) && (
                    <div style={{
                        marginTop: '0.2rem',
                        marginBottom: '1rem',
                        padding: '0.5rem 0.8rem',
                        backgroundColor: '#f7fafc',
                        borderRadius: '8px',
                        border: '1px solid #edf2f7',
                        fontSize: '0.85rem'
                    }}>
                        {gcLoading ? (
                            <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Fetching title...</span>
                        ) : gcMeta && (
                            <div style={{ color: '#4a5568', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 'bold', minWidth: 'fit-content' }}>{t('newNote.titleLabel')}</span>
                                    <span style={{ color: '#2d3748' }}>{gcMeta.title}</span>
                                </div>
                                {gcMeta.speaker && (
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, paddingLeft: 'calc(1.5rem + 0.5rem)' }}>
                                        {gcMeta.speaker}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {scripture && chapter && (['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants', 'Pearl of Great Price', 'Ordinances and Proclamations'].includes(scripture) || (typeof chapter === 'string' && chapter.startsWith('http'))) && (
                    <div className="gospel-link-container">
                        <a
                            href={typeof chapter === 'string' && chapter.startsWith('http') ? localizeLdsUrl(chapter, language) : getGospelLibraryUrl(scripture, chapter, language)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gospel-library-link"
                        >
                            {t('myNotes.readInGospelLibrary')} <i className="uil uil-external-link-alt" style={{ fontSize: '0.85em' }}></i>
                        </a>
                    </div>
                )}

                {/* AI Button - simple styling inline for now */}
                {!noteToEdit && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={handleGenerateQuestions}
                            disabled={aiLoading || !scripture || !chapter}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                padding: '0.3rem 0.8rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                opacity: (aiLoading || !scripture || !chapter) ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                            }}
                        >
                            {aiLoading ? 'Thinking...' : t('newNote.askAiQuestion')}
                        </button>
                    </div>
                )}

                {aiQuestion && (
                    <div style={{
                        backgroundColor: '#f0f4ff',
                        padding: '10px',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        border: '1px solid #dbe4ff',
                        position: 'relative'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', whiteSpace: 'pre-wrap' }}>
                            <strong>{t('newNote.aiQuestion')}</strong><br />
                            {aiQuestion}
                        </p>
                        <button
                            onClick={() => setAiQuestion('')}
                            style={{
                                position: 'absolute',
                                top: '5px',
                                right: '5px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#a0aec0',
                                fontSize: '1rem',
                                padding: '0 5px'
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}

                <Input
                    label={t('newNote.commentLabel')}
                    as="textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder={currentCommentPlaceholder}
                />

                {!noteToEdit && (
                    <div className="sharing-options">
                        <label className="sharing-label">{t('newNote.shareLabel')}</label>

                        <div className="radio-group">
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="all"
                                    checked={shareOption === 'all'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareAll')}</span>
                            </label>

                            {isGroupContext && (currentGroupId || userData.groupId) && (
                                <label className="radio-option">
                                    <input
                                        type="radio"
                                        value="current"
                                        checked={shareOption === 'current'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                    />
                                    <span>{t('newNote.shareCurrent')}</span>
                                </label>
                            )}

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="specific"
                                    checked={shareOption === 'specific'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareSpecific')}</span>
                            </label>

                            <label className="radio-option">
                                <input
                                    type="radio"
                                    value="none"
                                    checked={shareOption === 'none'}
                                    onChange={(e) => setShareOption(e.target.value)}
                                />
                                <span>{t('newNote.shareNone')}</span>
                            </label>
                        </div>

                        {shareOption === 'specific' && (
                            <div className="group-selection-list">
                                {userGroups.length === 0 && (
                                    <p style={{ color: 'var(--black)', fontStyle: 'italic', padding: '0.5rem' }}>
                                        {t('newNote.noGroups')}
                                    </p>
                                )}
                                {userGroups.map(group => (
                                    <label key={group.id} className="group-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedShareGroups.includes(group.id)}
                                            onChange={() => handleGroupSelection(group.id)}
                                        />
                                        <span>{group.name || t('newNote.unnamedGroup')}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-btn">{t('newNote.cancel')}</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !scripture || !chapter || !comment}
                        className="submit-btn"
                    >
                        {loading ? t('newNote.saving') : (noteToEdit ? <>✨ {t('newNote.update')}</> : <>✨ {t('newNote.post')}</>)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewNote;