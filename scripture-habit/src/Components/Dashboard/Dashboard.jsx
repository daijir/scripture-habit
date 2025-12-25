import React, { useState, useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Hero from '../Hero/Hero';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat';
import './Dashboard.css';
import Button from '../Button/Button';
import { Capacitor } from '@capacitor/core';

import NewNote from '../NewNote/NewNote';
import MyNotes from '../MyNotes/MyNotes';
import Profile from '../Profile/Profile';
import { getGospelLibraryUrl, getScriptureInfoFromText } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import NoteDisplay from '../NoteDisplay/NoteDisplay';
import NoteCard from '../NoteCard/NoteCard';
import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import WelcomeStoryModal from '../WelcomeStoryModal/WelcomeStoryModal';
import Donate from '../Donate/Donate';
import Mascot from '../Mascot/Mascot';



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
  const [latestNoteNotification, setLatestNoteNotification] = useState(null);

  const location = useLocation();
  // Initialize activeGroupId from location state if available, to avoid initial null state
  const [activeGroupId, setActiveGroupId] = useState(location.state?.initialGroupId || null);
  const [showWelcomeStory, setShowWelcomeStory] = useState(false);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const { t, language } = useLanguage();

  const todayPlan = getTodayReadingPlan();

  const getReadingPlanUrl = (script) => {
    // Basic heuristic for 2025 Curriculum (D&C)
    const baseUrl = "https://www.churchofjesuschrist.org/study/scriptures";
    const langParam = language === 'ja' ? '?lang=jpn' : '?lang=eng'; // Simplified lang check

    if (script.includes("Official Declarations")) {
      const match = script.match(/(\d+)(?::([\d\-\,]+))?/);
      const num = match ? match[1] : '1';
      return `${baseUrl}/dc-testament/od/${num}${langParam}`;
    }
    if (script.includes("The Family: A Proclamation")) {
      return `${baseUrl}/the-family-a-proclamation-to-the-world/the-family-a-proclamation-to-the-world${langParam}`;
    }
    if (script.includes("Joseph Smith—History") || script.includes("Joseph Smith-History")) {
      // Extract verses if any
      const match = script.match(/History\s*1(?::([\d\-\,]+))?/);
      const verses = match && match[1] ? `&id=${match[1]}#p${match[1].split('-')[0]}` : '';
      return `${baseUrl}/pgp/js-h/1${langParam}${verses}`;
    }
    if (script.includes("Articles of Faith")) {
      return `${baseUrl}/pgp/a-of-f/1${langParam}`;
    }

    // Default D&C
    // Check if it is D&C
    if (script.includes("Doctrine and Covenants")) {
      // Extract section
      const match = script.match(/(\d+)(?::([\d\-\,]+))?/);
      if (match) {
        const section = match[1];
        const verses = match[2] ? `&id=${match[2]}#p${match[2].split('-')[0]}` : '';
        return `${baseUrl}/dc-testament/dc/${section}${langParam}${verses}`;
      }
    }

    // Fallback: Try generic mapper
    return getGospelLibraryUrl("Doctrine and Covenants", script, language);
  };

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
              const data = docSnap.data();
              setUserData({ uid: currentUser.uid, ...data });

              // Show welcome story if not seen yet
              if (data.hasSeenWelcomeStory === undefined) {
                setTimeout(() => setShowWelcomeStory(true), 500);
              }
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

  // --- Just-In-Time Data Migration (Level Initialization) ---
  useEffect(() => {
    const migrateLevelData = async () => {
      // Trigger migration if missing OR if it's clearly incorrect (less than streak)
      const needsMigration = userData && (
        userData.daysStudiedCount === undefined ||
        (userData.daysStudiedCount < (userData.streakCount || 0))
      );

      if (!user || !userData || !needsMigration) return;

      console.log("Migration/Fix triggered: calculating accurate daysStudiedCount...");
      try {
        const notesRef = collection(db, 'users', user.uid, 'notes');
        const notesSnapshot = await getDocs(notesRef);

        const studyDays = new Set();
        notesSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.createdAt) {
            const date = data.createdAt.toDate();
            // Use local date string (YYYY-MM-DD) instead of UTC to avoid shifting days
            const dateStr = date.toLocaleDateString('sv-SE'); // 'sv-SE' gives YYYY-MM-DD
            studyDays.add(dateStr);
          }
        });

        // The real count should be the maximum of unique days with notes OR the current streak
        const initialDaysCount = Math.max(studyDays.size, userData.streakCount || 0);

        // Only update if the value is different from what we currently have
        if (initialDaysCount !== userData.daysStudiedCount) {
          await updateDoc(doc(db, 'users', user.uid), {
            daysStudiedCount: initialDaysCount,
            totalNotes: userData.totalNotes || notesSnapshot.size
          });
          console.log(`Level data corrected: ${initialDaysCount} days studied.`);
        }
      } catch (err) {
        console.error("Error during level data migration:", err);
      }
    };

    migrateLevelData();
  }, [user, userData?.daysStudiedCount, userData?.streakCount, userData?.uid]);
  // -----------------------------------------------------------



  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (user && userData && userData.hasSeenWelcomeStory === undefined) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenWelcomeStory: true
        });
      } catch (error) {
        console.error("Error marking welcome story as seen:", error);
      }
    }
  };

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
  }, [JSON.stringify(userData?.groupIds), userData?.groupId]);

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

  // Check for inactivity warnings
  useEffect(() => {
    if (!userData || userGroups.length === 0) return;

    const newWarnings = [];
    const now = new Date();

    userGroups.forEach(group => {
      const memberLastActive = group.memberLastActive || {};
      const lastActiveTimestamp = memberLastActive[userData.uid];

      if (lastActiveTimestamp) {
        const lastActiveDate = lastActiveTimestamp.toDate();
        // diff in ms
        const diffMs = now - lastActiveDate;
        // diff in days
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Warn if between 2 and 3 days (48h - 72h)
        if (diffDays >= 2 && diffDays < 3) {
          newWarnings.push(group.name || 'Group');
        }
      }
    });

    setWarnings(newWarnings);
  }, [userGroups, userData]);

  // Check for recent notes from others to show notification
  useEffect(() => {
    if (!userGroups || userGroups.length === 0 || !userData || loadingGroupStates) return;

    // Filter groups where someone ELSE posted a note today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    let mostRecent = null;

    userGroups.forEach(group => {
      if (group.lastNoteAt && group.lastNoteByUid !== userData.uid) {
        const noteTime = group.lastNoteAt.toMillis ? group.lastNoteAt.toMillis() : (group.lastNoteAt.seconds * 1000);

        // Check against lastReadAt in user's state for this group
        const state = groupStates[group.id];
        let lastReadTime = 0;
        if (state && state.lastReadAt) {
          lastReadTime = state.lastReadAt.toMillis ? state.lastReadAt.toMillis() : (state.lastReadAt.seconds * 1000);
        }

        // Only show if note is from today AND newer than user's last read time
        if (noteTime >= todayTime && noteTime > lastReadTime) {
          if (!mostRecent || noteTime > mostRecent.time) {
            mostRecent = {
              nickname: group.lastNoteByNickname,
              time: noteTime,
              groupId: group.id,
              groupName: group.name
            };
          }
        }
      }
    });

    setLatestNoteNotification(mostRecent);
  }, [userGroups, userData?.uid, groupStates, loadingGroupStates]);

  // --- Invitation Handling ---
  useEffect(() => {
    const processPendingInvite = async () => {
      const inviteCode = localStorage.getItem('pendingInviteCode');
      if (!inviteCode || !user || !userData || showWelcomeStory || isJoiningInvite) return;

      setIsJoiningInvite(true);
      console.log("Processing pending invite code:", inviteCode);

      try {
        // 1. Find the group by invite code
        const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.warn("Invite code invalid or group not found");
          localStorage.removeItem('pendingInviteCode');
          setIsJoiningInvite(false);
          return;
        }

        const groupDoc = querySnapshot.docs[0];
        const groupId = groupDoc.id;
        const groupData = groupDoc.data();

        // 2. Check if already a member
        const currentGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
        if (currentGroupIds.includes(groupId)) {
          console.log("User already in this group");
          localStorage.removeItem('pendingInviteCode');
          setIsJoiningInvite(false);
          // Just switch to this group
          setActiveGroupId(groupId);
          setSelectedView(2);
          return;
        }

        // 3. Join the group
        const API_BASE = Capacitor.isNativePlatform() ? 'https://scripture-habit.vercel.app' : '';
        const idToken = await user.getIdToken();
        const resp = await fetch(`${API_BASE}/api/join-group`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ groupId })
        });

        if (resp.ok) {
          // Success!
          localStorage.removeItem('pendingInviteCode');
          // Allow some time for Firestore listeners to catch up
          setTimeout(() => {
            setActiveGroupId(groupId);
            setSelectedView(2);
            setIsJoiningInvite(false);
            window.alert(`${t('joinGroup.joiningFromInviteSuccess')} (${groupData.name})`);
          }, 1000);
        } else {
          const errText = await resp.text();
          console.error("Failed to join via invite link:", errText);
          localStorage.removeItem('pendingInviteCode');
          setIsJoiningInvite(false);
        }

      } catch (error) {
        console.error("Error processing pending invite:", error);
        localStorage.removeItem('pendingInviteCode');
        setIsJoiningInvite(false);
      }
    };

    if (!showWelcomeStory && userData && user) {
      processPendingInvite();
    }
  }, [user, userData, showWelcomeStory, t]);

  if (loading) {
    return <div className='App Dashboard'>Loading...</div>;
  }

  if (error) {
    return <div className='App Dashboard' style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
  const pendingInviteCode = localStorage.getItem('pendingInviteCode');

  if (!hasGroups && !pendingInviteCode && !isJoiningInvite) {
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



  const handleUpdateProfile = async () => {
    if (!newNickname.trim() || !user || !userData) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        nickname: newNickname.trim()
      });
      // toast.success(t('groupChat.nicknameChanged')); // Assuming toast is available or imported if needed, otherwise rely on listener update
      setShowEditProfileModal(false);
      setNewNickname('');
    } catch (error) {
      console.error("Error updating nickname:", error);
      // toast.error(t('groupChat.errorChangeNickname'));
    }
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
          hideMobile={isInputFocused || isJoiningInvite}
        />
        {selectedView === 0 && (
          <div className="DashboardContent">
            {isJoiningInvite && (
              <div className="joining-overlay" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.8)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)'
              }}>
                <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
                <h3>{t('joinGroup.joiningFromInvite')}</h3>
              </div>
            )}
            <div className="dashboard-header">
              <div>
                <h1>Scripture Habit</h1>
                <p className="welcome-text">
                  {t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!
                  <button
                    className="edit-profile-btn"
                    onClick={() => {
                      setNewNickname(userData.nickname || '');
                      setShowEditProfileModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '0.5rem',
                      color: 'var(--gray)',
                      verticalAlign: 'middle',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <UilPen size="16" />
                  </button>
                </p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-banner">
                ⚠️ {language === 'ja'
                  ? `【警告】${warnings.join(', ')}での活動が2日以上ありません。今日投稿しないと退出になります！`
                  : `Warning: You have been inactive in ${warnings.join(', ')} for over 2 days. Post today to avoid removal!`}
              </div>
            )}

            <div className="dashboard-stats">
              <div className="stat-card streak-card">
                <h3>{t('dashboard.streak')}</h3>
                <div className="streak-value">
                  <span className="number">{userData.streakCount || 0}</span>
                  <span className="label">{t('dashboard.days')}</span>
                </div>

              </div>
              <div className="stat-card level-card">
                <h3>{t('profile.level')}</h3>
                <div className="streak-value">
                  <span className="number">
                    {Math.floor((userData.daysStudiedCount || 0) / 7) + 1}
                  </span>
                  <span className="label">Lv</span>
                </div>
                <div className="mini-progress-bar">
                  <div
                    className="mini-progress-fill"
                    style={{ width: `${((userData.daysStudiedCount || 0) % 7) / 7 * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="inspiration-section">
              <Mascot
                userData={userData}
                onClick={() => setShowWelcomeStory(true)}
              />

              {latestNoteNotification && (
                <div
                  className="note-notification"
                  onClick={() => {
                    setActiveGroupId(latestNoteNotification.groupId);
                    setSelectedView(2);
                  }}
                >
                  <span>📖</span>
                  {t('dashboard.postedANote', { nickname: latestNoteNotification.nickname })}
                </div>
              )}

              <div className="inspiration-card"
                style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => setShowWelcomeStory(true)}
              >
                <blockquote className="inspiration-quote">
                  {t('dashboard.inspirationQuote')}
                </blockquote>
                <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '10px',
                  background: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px 12px 12px 0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: '#4A5568',
                  border: '1px solid #E2E8F0',
                  minWidth: '24px',
                  textAlign: 'center'
                }}>
                  <span className="typing-dots"></span>
                </div>
              </div>
            </div>

            <div className="dashboard-split-row">
              <div className="reading-plan-section">
                <div className="reading-plan-card" style={{
                  background: 'rgba(255, 255, 255, 0.6)',
                  padding: '1.2rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#4a5568' }}>{t('dashboard.todaysComeFollowMe')}</h3>
                  {todayPlan ? (
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.5rem' }}>{todayPlan.date}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        {todayPlan.scripts.map((script, idx) => {
                          const url = getReadingPlanUrl(script);
                          const translations = {
                            "Official Declarations": {
                              ja: "公式の宣言",
                              pt: "Declarações Oficiais",
                              zho: "正式宣言",
                              es: "Declaraciones Oficiales",
                              vi: "Tuyên Ngôn Chính Thức",
                              th: "คำประกาศอย่างเป็นทางการ",
                              ko: "공식 선언",
                              tl: "Opisyal na Pahayag",
                              sw: "Matamko Rasmi"
                            },
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
                            "The Restoration of the Fulness of the Gospel of Jesus Christ": {
                              ja: "回復の宣言",
                              pt: "A Restauração",
                              zho: "復興宣文",
                              es: "La Restauración",
                              vi: "Sự Phục Hồi",
                              th: "การฟื้นฟู",
                              ko: "회복 선언문",
                              tl: "Ang Pagapanumbalik",
                              sw: "Urejesho"
                            },
                            "Doctrine and Covenants": {
                              ja: "教義と聖約",
                              pt: "Doutrina e Convênios",
                              zho: "教義和聖約",
                              es: "Doctrina y Convenios",
                              vi: "Giáo Lý và Giao Ước",
                              th: "หลักคำสอนและพันธสัญญา",
                              ko: "교리와 성약",
                              tl: "Doktrina at mga Tipan",
                              sw: "Mafundisho na Maagano"
                            },
                            "Articles of Faith": {
                              ja: "信仰箇条",
                              pt: "Regras de Fé",
                              zho: "信條",
                              es: "Artículos de Fe",
                              vi: "Những Tín Điều",
                              th: "หลักแห่งความเชื่อ",
                              ko: "신앙개조",
                              tl: "Mga Saligan ng Pananampalataya",
                              sw: "Makala ya Imani"
                            }
                          };

                          let displayScript = script;
                          for (const [key, langMap] of Object.entries(translations)) {
                            if (script.includes(key) && langMap[language]) {
                              displayScript = script.replace(key, langMap[language]);
                              break;
                            }
                          }
                          return (
                            <a
                              key={idx}
                              href={url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6B46C1', fontWeight: 'bold', textDecoration: 'none', fontSize: '1.1rem' }}
                            >
                              {displayScript}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p>{t('dashboard.noReadingPlan')}</p>
                  )}
                </div>
              </div>

              <div className="share-learning-cta">
                <p>{t('dashboard.shareLearningCall')}</p>
                <button className="new-note-btn cta-btn" onClick={() => setIsModalOpen(true)}>
                  <UilPlus /> {t('dashboard.newNote')}
                </button>
              </div>
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
                      <NoteCard
                        key={note.id}
                        note={note}
                        className="dashboard-note-card"
                        isEditable={false}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 1 && (
          <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={userGroups} />
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
          <Profile
            userData={userData}
            stats={{
              streak: userData?.streakCount || 0,
              totalNotes: personalNotesCount !== null ? personalNotesCount : 0,
              daysStudied: userData?.daysStudiedCount || 0
            }}
          />
        )}
        {selectedView === 4 && (
          <Donate userData={userData} />
        )}

        <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={userGroups} currentGroupId={activeGroupId} />

        <WelcomeStoryModal
          isOpen={showWelcomeStory}
          onClose={handleCloseWelcomeStory}
          userData={userData}
        />

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="leave-modal-overlay" style={{ zIndex: 2000 }}>
            <div className="leave-modal-content">
              <h3>{t('groupChat.changeNickname')}</h3>
              <input
                type="text"
                className="delete-confirmation-input"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder={t('groupChat.enterNewNickname')}
                style={{ marginTop: '1rem', marginBottom: '1rem' }}
              />
              <div className="leave-modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => { setShowEditProfileModal(false); setNewNickname(''); }}
                >
                  {t('groupChat.cancel')}
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleUpdateProfile}
                  disabled={!newNickname.trim() || newNickname === userData?.nickname}
                >
                  {t('groupChat.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;