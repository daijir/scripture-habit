import React, { useState, useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { UilPlus } from '@iconscout/react-unicons';
import Hero from '../Hero/Hero';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat';
import './Dashboard.css';
import Button from '../Button/Button';
import GalleryImages from '../GalleryImages/GalleryImages';
import NewNote from '../NewNote/NewNote';
import MyNotes from '../MyNotes/MyNotes';
import Languages from '../Languages/Languages';
import { getGospelLibraryUrl, getScriptureInfoFromText } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { useLanguage } from '../../Context/LanguageContext.jsx';


const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState(0);
  const [groupTotalNotes, setGroupTotalNotes] = useState(0);
  const [personalNotesCount, setPersonalNotesCount] = useState(null);
  const [recentNotes, setRecentNotes] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [rawUserGroups, setRawUserGroups] = useState([]);
  const [groupStates, setGroupStates] = useState({});
  const [loadingGroupStates, setLoadingGroupStates] = useState(true);

  const location = useLocation();
  // Initialize activeGroupId from location state if available, to avoid initial null state
  const [activeGroupId, setActiveGroupId] = useState(location.state?.initialGroupId || null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    if (location.state?.initialView !== undefined) {
      setSelectedView(location.state.initialView);
    }
    if (location.state?.initialGroupId) {
      setActiveGroupId(location.state.initialGroupId);
    }
  }, [location.state]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          // Use onSnapshot for real-time updates to user profile
          const unsubUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserData({ uid: currentUser.uid, ...docSnap.data() });
            } else {
              console.log("No such user document!");
              setError("User profile not found.");
            }
            setLoading(false);
          }, (err) => {
            console.error("Error fetching user data:", err);
            setError(err.message);
            setLoading(false);
          });
          return () => unsubUser();
        } catch (err) {
          console.error("Error setting up user listener:", err);
          setError(err.message);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch user groups details
  useEffect(() => {
    if (!userData) return;

    const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

    if (groupIds.length === 0) {
      setRawUserGroups([]);
      return;
    }

    // Set active group if not set
    if (!activeGroupId && groupIds.length > 0) {
      setActiveGroupId(groupIds[0]);
    }

    const fetchGroups = async () => {
      const unsubscribers = [];
      const groupsData = {};

      groupIds.forEach(gid => {
        const unsub = onSnapshot(doc(db, 'groups', gid), (docSnap) => {
          if (docSnap.exists()) {
            groupsData[gid] = { id: gid, ...docSnap.data() };
            // Update state with new data
            setRawUserGroups(prev => {
              // Re-map based on groupIds order to keep consistency
              const newGroups = groupIds
                .map(id => groupsData[id] || prev.find(g => g.id === id))
                .filter(Boolean);
              return newGroups;
            });
          }
        });
        unsubscribers.push(unsub);
      });

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    };

    const cleanupPromise = fetchGroups();
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [userData?.groupIds, userData?.groupId]);

  // Fetch user group states (read counts)
  useEffect(() => {
    if (!userData?.uid) return;

    setLoadingGroupStates(true);
    const groupStatesRef = collection(db, 'users', userData.uid, 'groupStates');
    const unsubscribe = onSnapshot(groupStatesRef, (snapshot) => {
      const states = {};
      snapshot.forEach(doc => {
        states[doc.id] = doc.data();
      });
      setGroupStates(states);
      setLoadingGroupStates(false);
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  // Combine raw groups with unread counts
  useEffect(() => {
    const combinedGroups = rawUserGroups.map(group => {
      const state = groupStates[group.id];
      // If still loading states, assume everything is read to prevent flash of unread count
      // If loaded and no state exists, then it's truly unread (readCount 0)
      const readCount = loadingGroupStates ? (group.messageCount || 0) : (state?.readMessageCount || 0);
      const totalCount = group.messageCount || 0;
      const unreadCount = Math.max(0, totalCount - readCount);

      return {
        ...group,
        unreadCount
      };
    });
    setUserGroups(combinedGroups);
  }, [rawUserGroups, groupStates, loadingGroupStates]);

  // Update activeGroupId if the user leaves the current group or if we need to validate the current selection
  useEffect(() => {
    // IMPORTANT: Do not reset activeGroupId while initial data is loading
    if (loading) return;

    if (userGroups.length > 0) {
      // Check if the currently active group is loaded in userGroups
      const isActiveGroupLoaded = userGroups.find(g => g.id === activeGroupId);

      if (!isActiveGroupLoaded) {
        // If not loaded, check if it's at least in the user's group list (pending load)
        // This prevents resetting activeGroupId while the specific group data is being fetched
        const userGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
        const isMemberOfActiveGroup = activeGroupId && userGroupIds.includes(activeGroupId);

        if (!isMemberOfActiveGroup) {
          // Only reset if the user is NOT a member of the active group
          setActiveGroupId(userGroups[0].id);
        }
      }
    } else {
      // Only reset if user truly has no groups (avoid resetting during loading)
      const hasGroups = userData && ((userData.groupIds && userData.groupIds.length > 0) || userData.groupId);
      if (!hasGroups) {
        setActiveGroupId(null);
      }
    }
  }, [userGroups, userData, activeGroupId, loading]);

  useEffect(() => {
    if (!userData || !userData.uid) return;

    try {
      const notesRef = collection(db, 'users', userData.uid, 'notes');
      const q = query(
        notesRef,
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsubscribeRecent = onSnapshot(q, (querySnapshot) => {
        const notes = [];
        querySnapshot.forEach((doc) => {
          notes.push({ id: doc.id, ...doc.data() });
        });
        setRecentNotes(notes);
      }, (err) => {
        if (err.code !== 'permission-denied') {
          console.error("Error fetching recent notes:", err);
        }
      });

      return () => unsubscribeRecent();
    } catch (err) {
      console.error("Error setting up recent notes listener:", err);
    }
  }, [userData?.uid]);

  // Calculate total personal notes
  useEffect(() => {
    if (!userData || !userData.uid) return;

    try {
      const notesRef = collection(db, 'users', userData.uid, 'notes');
      const unsubscribeTotalNotes = onSnapshot(notesRef, (querySnapshot) => {
        setPersonalNotesCount(querySnapshot.size);
      }, (err) => {
        console.error("Error fetching total notes count:", err);
      });

      return () => unsubscribeTotalNotes();
    } catch (err) {
      console.error("Error setting up total notes listener:", err);
    }
  }, [userData?.uid]);

  useEffect(() => {
    let unsubscribeGroupNotes = null;
    if (userData && activeGroupId) {
      try {
        const messagesRef = collection(db, 'groups', activeGroupId, 'messages');
        const q = query(messagesRef, where('isNote', '==', true));
        unsubscribeGroupNotes = onSnapshot(q, (querySnapshot) => {
          setGroupTotalNotes(querySnapshot.size || 0);
        }, (err) => {
          if (err.code !== 'permission-denied') {
            console.error('Error fetching group notes count:', err);
          }
        });
      } catch (err) {
        console.error('Error setting up group notes listener:', err);
      }
    } else {
      setGroupTotalNotes(0);
    }
    return () => {
      if (unsubscribeGroupNotes) unsubscribeGroupNotes();
    };
  }, [userData, activeGroupId]);

  if (loading) {
    return <div className='App Dashboard'>Loading...</div>;
  }

  if (error) {
    return <div className='App Dashboard' style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!user) {
    return <div className='App Dashboard'>Please log in to view the dashboard.</div>;
  }

  if (!userData) {
    return (
      <div className='App Dashboard'>
        <div className='AppGlass welcome'>
          <h1>Welcome!</h1>
          <p>Your user profile is being set up or could not be found.</p>
          <Link to="/group-form">
            <Button className="create-btn">Create a Group</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Allow access if user has groups, even if groupId is not set (migration case)
  const hasGroups = (userData.groupIds && userData.groupIds.length > 0) || userData.groupId;

  if (!hasGroups) {
    return <Navigate to="/group-options" replace />;
  }

  const getDisplayStreak = () => {
    try {
      if (!userData) return 0;
      const streak = userData.streakCount || 0;
      if (!userData.lastPostDate) return 0;

      let timeZone = userData.timeZone || 'UTC';
      try {
        Intl.DateTimeFormat(undefined, { timeZone });
      } catch (e) {
        console.warn("Invalid timezone in userData, falling back to UTC:", timeZone);
        timeZone = 'UTC';
      }

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone });

      let lastPostDate;
      if (userData.lastPostDate && typeof userData.lastPostDate.toDate === 'function') {
        lastPostDate = userData.lastPostDate.toDate();
      } else {
        lastPostDate = new Date(userData.lastPostDate);
      }

      if (isNaN(lastPostDate.getTime())) return 0;

      const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });

      const today = new Date(todayStr);
      const lastPost = new Date(lastPostDateStr);
      const diffTime = today - lastPost;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) return streak;

      return 0;
    } catch (error) {
      console.error("Error calculating streak:", error);
      return 0;
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
    <div className='App Dashboard'>
      <div className='AppGlass Grid'>
        <Sidebar
          selected={selectedView}
          setSelected={setSelectedView}
          userGroups={userGroups}
          activeGroupId={activeGroupId}
          setActiveGroupId={setActiveGroupId}
          hideMobile={isInputFocused}
        />
        {selectedView === 0 && (
          <div className="DashboardContent">
            <div className="dashboard-header">
              <div>
                <h1>Scripture Habit</h1>
                <p className="welcome-text">{t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!</p>
              </div>
            </div>

            <div className="dashboard-stats">
              <div className="stat-card streak-card">
                <h3>{t('dashboard.streak')}</h3>
                <div className="streak-value">
                  <span className="number">{userData.streakCount || 0}</span>
                  <span className="label">{t('dashboard.days')}</span>
                </div>

              </div>
              <div className="stat-card">
                <h3>{t('dashboard.totalNotes')}</h3>
                <div className="streak-value">
                  <span className="number">
                    {personalNotesCount !== null ? personalNotesCount : (userData.totalNotes || 0)}
                  </span>
                  <span className="label">{t('dashboard.notes')}</span>
                </div>
              </div>
            </div>

            <div className="inspiration-section">
              <div className="inspiration-card">

                <blockquote className="inspiration-quote">
                  {t('dashboard.inspirationQuote')}
                </blockquote>
                <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>

              </div>
            </div>

            <div className="share-learning-cta">
              <p>{t('dashboard.shareLearningCall')}</p>
              <button className="new-note-btn cta-btn" onClick={() => setIsModalOpen(true)}>
                <UilPlus /> {t('dashboard.newNote')}
              </button>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>{t('dashboard.recentNotes')}</h3>
                <Link to="#" className="see-all" onClick={(e) => { e.preventDefault(); setSelectedView(1); }}>{t('dashboard.seeAll')}</Link>
              </div>
              <div className="gallery-container">
                <div className="recent-notes-grid">
                  {recentNotes.length === 0 ? (
                    <p className="no-notes-dashboard">{t('dashboard.noRecentNotes')}</p>
                  ) : (
                    recentNotes.map((note) => (
                      <div key={note.id} className="note-card dashboard-note-card">
                        <div className="note-date">
                          {note.createdAt?.toDate().toLocaleDateString() || 'Unknown Date'}
                        </div>
                        <div className="note-content">
                          <ReactMarkdown>
                            {formatNoteForDisplay(note.text)}
                          </ReactMarkdown>
                        </div>
                        {getGospelLibraryUrl(note.scripture, note.chapter, language) && (
                          <a
                            href={getGospelLibraryUrl(note.scripture, note.chapter, language)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gospel-link"
                            style={{
                              display: 'inline-block',
                              marginTop: '10px',
                              fontSize: '0.8rem',
                              color: 'var(--gray)',
                              textDecoration: 'none',
                              fontWeight: 'bold'
                            }}
                          >
                            📖 {t('dashboard.readInGospelLibrary')}
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>{t('dashboard.randomPhoto')}</h3>
              </div>
              <div className="gallery-container">
                <GalleryImages />
              </div>
            </div>

          </div>
        )}
        {selectedView === 1 && (
          <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
        )}
        {selectedView === 2 && (
          <GroupChat
            groupId={activeGroupId}
            userData={userData}
            userGroups={userGroups}
            isActive={true}
            onInputFocusChange={setIsInputFocused}
            onBack={() => setSelectedView(0)}
            onGroupSelect={setActiveGroupId}
          />
        )}
        {selectedView === 3 && (
          <Languages />
        )}

        <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={userGroups} currentGroupId={activeGroupId} />
      </div>
    </div>
  );
};
export default Dashboard;