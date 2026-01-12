import React, { useState, useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { safeStorage } from '../../Utils/storage';
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
import { toast } from 'react-toastify';

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
import Footer from '../Footer/Footer';
import { DashboardSkeleton } from '../Skeleton/Skeleton';
import { requestNotificationPermission } from '../../Utils/notificationHelper';
import NotificationPromptModal from './NotificationPromptModal';




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
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const { t, language } = useLanguage();

  const todayPlan = getTodayReadingPlan();

  const getReadingPlanUrl = (script) => {
    // Simply call the smart mapper without an explicit volume.
    // gospelLibraryMapper.js now handles the detection.
    return getGospelLibraryUrl(null, script, language);
  };

  useEffect(() => {
    if (location.state?.initialView !== undefined) {
      setSelectedView(location.state.initialView);
    }
    if (location.state?.initialGroupId) {
      setActiveGroupId(location.state.initialGroupId);
    }

    // Handle deep-linking from URL query parameters (e.g., from notifications)
    const searchParams = new URLSearchParams(location.search);
    const gid = searchParams.get('groupId');
    if (gid) {
      setActiveGroupId(gid);
      setSelectedView(2); // Switch to GroupChat view

      // Clean up the URL to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const openNewNote = searchParams.get('openNewNote');
    if (openNewNote === 'true') {
      setIsModalOpen(true);
      // Clean URL for this too
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const viewParam = searchParams.get('view');
    if (viewParam) {
      setSelectedView(parseInt(viewParam));
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search, location.state]);

  useEffect(() => {
    // Show notification prompt after 3 seconds on dashboard
    if (selectedView === 0 && !loading && userData) {
      const timer = setTimeout(() => {
        const isPermissionDefault = window.Notification && window.Notification.permission === 'default';
        const lastPrompt = safeStorage.get('lastNotifPrompt');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        if (isPermissionDefault && (!lastPrompt || now - parseInt(lastPrompt) > oneWeek)) {
          setShowNotifPrompt(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedView, loading, userData]);

  const handleEnableNotifications = async () => {
    setShowNotifPrompt(false);
    safeStorage.set('lastNotifPrompt', Date.now().toString());
    if (userData?.uid) {
      await requestNotificationPermission(userData.uid, t);
    }
  };

  const handleCloseNotifPrompt = () => {
    setShowNotifPrompt(false);
    safeStorage.set('lastNotifPrompt', Date.now().toString());
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Notification permission is now requested manually via the bell icon
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
              setLoading(false);
              setError(null);
            } else {
              // Sign of deletion or missing profile - keep quiet and let navigate() handle it
              console.log("User profile document no longer exists (might be deleting account).");
              setLoading(false);
            }
          }, (err) => {
            // Silence "permission-denied" errors during account deletion or logout
            if (err.code === 'permission-denied') {
              console.log("Silenced permission error during possible logout/deletion.");
              setLoading(false);
              return;
            }
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
        }, (err) => {
          if (err.code !== 'permission-denied') {
            console.error(`Error fetching group ${gid}:`, err);
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
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("Error fetching group states:", err);
      }
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

  // No longer using real-time listener for the entire collection to get count
  // personalNotesCount is now derived from userData.totalNotes
  useEffect(() => {
    if (userData) {
      setPersonalNotesCount(userData.totalNotes || 0);
    }
  }, [userData?.totalNotes]);

  useEffect(() => {
    if (userData && activeGroupId) {
      const activeGroup = userGroups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        setGroupTotalNotes(activeGroup.noteCount || 0);
      }
    } else {
      setGroupTotalNotes(0);
    }
  }, [activeGroupId, userGroups]);

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
      const noteTime = group.lastNoteAt ? (group.lastNoteAt.toMillis ? group.lastNoteAt.toMillis() : (group.lastNoteAt.seconds * 1000)) : 0;
      const messageTime = group.lastMessageAt ? (group.lastMessageAt.toMillis ? group.lastMessageAt.toMillis() : (group.lastMessageAt.seconds * 1000)) : 0;

      // Determine which one is newer and should be considered
      let currentType = '';
      let currentTime = 0;
      let currentNickname = '';
      let currentUid = '';

      if (noteTime >= messageTime && noteTime > 0) {
        currentType = 'note';
        currentTime = noteTime;
        currentNickname = group.lastNoteByNickname;
        currentUid = group.lastNoteByUid;
      } else if (messageTime > noteTime && messageTime > 0) {
        currentType = 'message';
        currentTime = messageTime;
        currentNickname = group.lastMessageByNickname;
        currentUid = group.lastMessageByUid;
      }

      if (currentTime > 0 && currentUid !== userData.uid) {
        // Only show if newer than today AND the group has unread messages
        if (currentTime >= todayTime && (group.unreadCount || 0) > 0) {
          if (!mostRecent || currentTime > mostRecent.time) {
            mostRecent = {
              type: currentType,
              nickname: currentNickname || 'Someone',
              time: currentTime,
              groupId: group.id,
              groupName: group.name,
              totalMessages: group.messageCount || 0
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
      const inviteCode = safeStorage.get('pendingInviteCode');
      if (!inviteCode || !user || !userData || showWelcomeStory || isJoiningInvite) return;

      setIsJoiningInvite(true);
      console.log("Processing pending invite code:", inviteCode);

      try {
        // 1. Find the group by invite code
        const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.warn("Invite code invalid or group not found");
          safeStorage.remove('pendingInviteCode');
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
          safeStorage.remove('pendingInviteCode');
          setIsJoiningInvite(false);
          // Just switch to this group
          setActiveGroupId(groupId);
          setSelectedView(2);
          return;
        }

        // 3. Join the group
        const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
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
          safeStorage.remove('pendingInviteCode');
          // Allow some time for Firestore listeners to catch up
          setTimeout(() => {
            setActiveGroupId(groupId);
            setSelectedView(2);
            setIsJoiningInvite(false);
            toast.success(`🎉 ${t('joinGroup.joiningFromInviteSuccess')} (${groupData.name})`);
          }, 1000);
        } else {
          const errText = await resp.text();
          console.error("Failed to join via invite link:", errText);
          safeStorage.remove('pendingInviteCode');
          setIsJoiningInvite(false);
        }

      } catch (error) {
        console.error("Error processing pending invite:", error);
        safeStorage.remove('pendingInviteCode');
        setIsJoiningInvite(false);
      }
    };

    if (!showWelcomeStory && userData && user) {
      processPendingInvite();
    }
  }, [user, userData, showWelcomeStory, t]);

  if (loading) {
    return (
      <div className='App Dashboard'>
        <div className='AppGlass Grid'>
          <Sidebar selected={selectedView} setSelected={setSelectedView} userGroups={[]} />
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    const isQuotaError = error.toLowerCase().includes('quota exceeded') || error.toLowerCase().includes('resource-exhausted');

    if (isQuotaError) {
      return (
        <div className='App Dashboard' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className='AppGlass' style={{
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(15px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            <div style={{ fontSize: '3rem' }}>🛠️</div>
            <h2 style={{ color: '#2d3748', margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>
              {t('systemErrors.quotaExceededTitle')}
            </h2>
            <p style={{ color: '#4a5568', margin: 0, lineHeight: '1.6', fontSize: '1rem' }}>
              {t('systemErrors.quotaExceededMessage')}
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(107, 70, 193, 0.1)',
              borderRadius: '12px',
              fontSize: '0.9rem',
              color: '#FF919D',
              fontWeight: '600'
            }}>
              Expected Reset: 17:00 JST / 8:00 AM UTC
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.8rem 1.5rem',
                background: 'linear-gradient(135deg, #FF919D 0%, #4a90e2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <div className='App Dashboard' style={{ color: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error: {error}</div>;
  }

  if (!user) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    return <Navigate to={isStandalone ? "/welcome" : "/"} replace />;
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
  const pendingInviteCode = safeStorage.get('pendingInviteCode');

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
      toast.success(t('groupChat.nicknameChanged'));
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
          userData={userData}
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

              {!hasGroups && (
                <div className="no-group-cta">
                  <p>{t('dashboard.joinGroupStudy')}</p>
                  <Link to="/group-options">
                    <button className="cta-btn">{t('dashboard.joinCreateGroup')}</button>
                  </Link>
                </div>
              )}

              {latestNoteNotification && (
                <div
                  className="note-notification"
                  onClick={async () => {
                    const gid = latestNoteNotification.groupId;
                    const totalMsgs = latestNoteNotification.totalMessages;

                    // Immediately switch view and clear notification locally
                    setActiveGroupId(gid);
                    setSelectedView(2);
                    setLatestNoteNotification(null);

                    // Update read status in background
                    if (userData?.uid) {
                      try {
                        const { doc, setDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
                        const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', gid);
                        const groupRef = doc(db, 'groups', gid);

                        await Promise.all([
                          setDoc(userGroupStateRef, {
                            readMessageCount: totalMsgs,
                            lastReadAt: serverTimestamp()
                          }, { merge: true }),
                          updateDoc(groupRef, {
                            [`memberLastReadAt.${userData.uid}`]: serverTimestamp()
                          })
                        ]);
                      } catch (err) {
                        console.error("Background read status update failed:", err);
                      }
                    }
                  }}
                >
                  <span>{latestNoteNotification.type === 'note' ? '📖' : '💬'}</span>
                  {t(latestNoteNotification.type === 'note' ? 'dashboard.postedANote' : 'dashboard.sentAMessage', { nickname: latestNoteNotification.nickname })}
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
                          const displayScript = translateChapterField(script, language);

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
            <Footer />
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
            isExternalModalOpen={isModalOpen || showEditProfileModal || showWelcomeStory || showNotifPrompt || isJoiningInvite}
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

        <NotificationPromptModal
          isOpen={showNotifPrompt}
          onClose={handleCloseNotifPrompt}
          onConfirm={handleEnableNotifications}
          t={t}
        />
      </div>
    </div >
  );
};
export default Dashboard;