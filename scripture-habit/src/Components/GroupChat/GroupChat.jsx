import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { db, auth } from '../../firebase';
import { UilPlus, UilSignOutAlt, UilCopy, UilTrashAlt, UilTimes, UilArrowLeft, UilPlusCircle, UilUsersAlt, UilPen } from '@iconscout/react-unicons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, where, getDocs, increment, setDoc, getDoc, limit, startAfter, startAt, endBefore } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import NewNote from '../NewNote/NewNote';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import LinkPreview from '../LinkPreview/LinkPreview';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';
import NoteDisplay from '../NoteDisplay/NoteDisplay';
import confetti from 'canvas-confetti';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import Mascot from '../Mascot/Mascot';

const GroupChat = ({ groupId, userData, userGroups, isActive = false, onInputFocusChange, onBack, onGroupSelect }) => {
  const { language, t } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripture-habit.vercel.app' : '';
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, messageId: null });
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [noteToEdit, setNoteToEdit] = useState(null);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactionsToShow, setReactionsToShow] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [userReadCount, setUserReadCount] = useState(null);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [showInactivityPolicyBanner, setShowInactivityPolicyBanner] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showUnityModal, setShowUnityModal] = useState(false);
  const [unityModalData, setUnityModalData] = useState({ posted: [], notPosted: [] });
  const longPressTimer = useRef(null);
  const containerRef = useRef(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const latestMessageRef = useRef(null);
  const [showAddNoteTooltip, setShowAddNoteTooltip] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const hasDismissed = localStorage.getItem('hasDismissedInactivityPolicy');
    if (!hasDismissed) {
      setShowInactivityPolicyBanner(true);
    }

    // Check for welcome guide logic from navigation state
    if (location.state?.showWelcome && location.state?.initialGroupId === groupId) {
      setShowWelcomeGuide(true);
      // Clear the state so it doesn't show again on refresh/back (optional, but good practice)
      // However, standard browser history might keep it. Ideally we rely on it being one-time.
      // We can't easily clear location state without replacing history.
      // window.history.replaceState({}, document.title); 
    }
  }, [location.state, groupId]);

  // Show tooltip every 6 visits
  useEffect(() => {
    if (!groupId) return;

    // Clean up old localStorage key (migration)
    const oldKey = localStorage.getItem('hasSeenAddNoteTooltip');
    if (oldKey) {
      localStorage.removeItem('hasSeenAddNoteTooltip');
    }

    // Get current visit count
    const visitCountStr = localStorage.getItem('groupChatVisitCount');
    const visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0;

    // Increment visit count
    const newVisitCount = visitCount + 1;
    localStorage.setItem('groupChatVisitCount', newVisitCount.toString());

    // Show tooltip every 2th visit (1, 7, 13, 19, ...)
    if (newVisitCount % 2 === 1) {
      // Show tooltip after a short delay for better UX
      const timer = setTimeout(() => {
        setShowAddNoteTooltip(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
    }
  }, [groupId]);


  const handleDismissTooltip = () => {
    setShowAddNoteTooltip(false);
  };

  const handleDismissInactivityBanner = () => {
    setShowInactivityPolicyBanner(false);
    localStorage.setItem('hasDismissedInactivityPolicy', 'true');
  };

  // Robust ownership check
  const isOwner = useMemo(() => {
    if (!groupData?.ownerUserId || !userData?.uid) return false;
    return String(groupData.ownerUserId).trim() === String(userData.uid).trim();
  }, [groupData, userData]);


  const handleDismissWelcomeGuide = () => {
    setShowWelcomeGuide(false);
  };
  const textareaRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentGroupIdRef = useRef(groupId);

  const scrollDebounceRef = useRef(null);
  const previousScrollHeightRef = useRef(0);


  useEffect(() => {
    if (!groupId) return;

    // Update ref FIRST - this is the source of truth for current group
    currentGroupIdRef.current = groupId;

    // Reset all states when group changes
    setLoading(true);
    setMessages([]);
    setGroupData(null);
    setInitialScrollDone(false);
    setUserReadCount(null);
    setHasMoreOlder(true);
    prevMessageCountRef.current = 0;
    latestMessageRef.current = null;

    let unsubscribeGroup = () => { };
    let unsubscribeNewMessages = () => { };

    const groupRef = doc(db, 'groups', groupId);
    unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        // Include groupId with the data so we can validate it later
        setGroupData({ ...docSnap.data(), _groupId: groupId });
      }
    });

    const initMessages = async () => {
      try {
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        const lastViewedMsgId = userData?.uid ? localStorage.getItem(`last_viewed_msg_${groupId}_${userData.uid}`) : null;

        let initialMsgs = [];
        let anchorSnapshot = null;

        // Strategy: 
        // 1. Try to fetch the 'last viewed' message to establish an anchor.
        // 2. If it exists, fetch surrounding messages (e.g. 5 before, 15 after).
        // 3. If not, fetch the latest 20 messages.

        if (lastViewedMsgId) {
          try {
            // We need to get the actual document snapshot to use as a cursor
            const anchorRef = doc(db, 'groups', groupId, 'messages', lastViewedMsgId);
            anchorSnapshot = await getDoc(anchorRef);
          } catch (e) {
            console.log("Could not fetch anchor", e);
          }
        }

        if (anchorSnapshot && anchorSnapshot.exists()) {
          // Restoring position from anchor
          // Newer context (including anchor) - "startAt" includes the anchor
          const nextQuery = query(messagesRef, orderBy('createdAt', 'asc'), startAt(anchorSnapshot), limit(15));
          const nextSnaps = await getDocs(nextQuery);
          const nextMsgs = nextSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

          // Older context - "startAfter" excludes anchor (going backwards, so older than anchor)
          // We use 'desc' to get the immediately preceding messages
          const prevQuery = query(messagesRef, orderBy('createdAt', 'desc'), startAfter(anchorSnapshot), limit(5));
          const prevSnaps = await getDocs(prevQuery);
          const prevMsgs = prevSnaps.docs.map(d => ({ id: d.id, ...d.data() })).reverse();

          initialMsgs = [...prevMsgs, ...nextMsgs];
        } else {
          // Fallback: Latest 20
          // We query descending to get the newest, then reverse to display chronologically
          const latestQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(20));
          const latestSnaps = await getDocs(latestQuery);
          initialMsgs = latestSnaps.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        }

        setMessages(initialMsgs);
        setLoading(false);

        // Setup Real-time listener for NEW messages
        // Listen for messages created AFTER the last message in our initial list
        if (initialMsgs.length > 0) {
          const lastMsg = initialMsgs[initialMsgs.length - 1];
          latestMessageRef.current = lastMsg;

          if (lastMsg.createdAt) {
            const newMsgsQuery = query(
              messagesRef,
              orderBy('createdAt', 'asc'),
              startAfter(lastMsg.createdAt)
            );

            unsubscribeNewMessages = onSnapshot(newMsgsQuery, (snapshot) => {
              const newIncoming = [];
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                  const data = change.doc.data();

                  // Trigger confetti for streaks!
                  if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid) {
                    confetti({
                      particleCount: 150,
                      spread: 70,
                      origin: { y: 0.6 },
                      zIndex: 10000
                    });
                  }

                  newIncoming.push({ id: change.doc.id, ...data });
                }
                if (change.type === "modified") {
                  setMessages(prev => prev.map(m => m.id === change.doc.id ? { id: change.doc.id, ...change.doc.data() } : m));
                }
                if (change.type === "removed") {
                  setMessages(prev => prev.filter(m => m.id !== change.doc.id));
                }
              });

              if (newIncoming.length > 0) {
                setMessages(prev => {
                  const cleanIncoming = newIncoming.filter(n => !prev.some(p => p.id === n.id));
                  return [...prev, ...cleanIncoming];
                });
              }
            });
          }
        } else {
          // If no messages at all, simply listen for any new messages
          const allNewQuery = query(messagesRef, orderBy('createdAt', 'asc'));
          unsubscribeNewMessages = onSnapshot(allNewQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();

                // Trigger confetti for streaks (avoiding local user duplication)
                if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid) {
                  confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    zIndex: 10000
                  });
                }

                setMessages(prev => {
                  if (prev.some(m => m.id === change.doc.id)) return prev;
                  return [...prev, { id: change.doc.id, ...data }];
                });
              }
              if (change.type === "modified") {
                setMessages(prev => prev.map(m => m.id === change.doc.id ? { id: change.doc.id, ...change.doc.data() } : m));
              }
              if (change.type === "removed") {
                setMessages(prev => prev.filter(m => m.id !== change.doc.id));
              }
            });
            setLoading(false);
          });
        }

      } catch (err) {
        if (err.code !== 'permission-denied') {
          console.error("Error fetching messages:", err);
          setError("Failed to load messages.");
        }
        setLoading(false);
      }
    };

    initMessages();

    return () => {
      unsubscribeGroup();
      unsubscribeNewMessages();
    };
  }, [groupId]);

  const inputPlaceholder = useMemo(() => {
    const typeMessageRaw = t('groupChat.typeMessage');
    let candidates = [];

    if (Array.isArray(typeMessageRaw)) {
      // If it's an array (humorous list), add all items to increase their frequency
      candidates = [...typeMessageRaw];
    } else {
      // If string (other languages), just add the single string
      candidates.push(typeMessageRaw);
    }

    // Add other placeholders to the pool
    // In Japanese, these will be "diluted" by the many humorous options, appearing less frequently
    candidates.push(t('groupChat.placeholderInactivity'));
    candidates.push(t('groupChat.placeholderShare'));
    candidates.push(t('groupChat.placeholderEncourage'));

    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [t, groupId, language]); // Re-roll when group or language changes

  // Fetch user's read count when entering the group
  useEffect(() => {
    if (!groupId || !userData?.uid) return;

    let cancelled = false;
    const currentGroupId = groupId; // Capture current groupId

    const fetchReadCount = async () => {
      try {
        const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', currentGroupId);
        // Use getDocFromServer to bypass cache
        const { getDocFromServer } = await import('firebase/firestore');
        const stateSnap = await getDocFromServer(userGroupStateRef);

        // Check if this request is still valid (groupId hasn't changed)
        if (cancelled) {
          return;
        }

        if (stateSnap.exists()) {
          const data = stateSnap.data();
          setUserReadCount(data.readMessageCount || 0);
        } else {
          setUserReadCount(0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching read count:", error);
          setUserReadCount(0);
        }
      }
    };

    fetchReadCount();

    return () => {
      cancelled = true;
    };
  }, [groupId, userData?.uid]);

  // Update read status when viewing the group (only when isActive and after initial scroll)
  useEffect(() => {
    if (!isActive || !userData || !groupId || !groupData || !initialScrollDone) return;

    // CRITICAL: Validate that groupData belongs to the current groupId
    if (groupData._groupId !== groupId) {
      return;
    }

    // Check if this is still the current group
    if (groupId !== currentGroupIdRef.current) {
      return;
    }

    // Cache values at effect start to prevent stale closures
    const cachedGroupId = groupId;
    const cachedMessageCount = groupData?.messageCount || messages.length; // Use group total count to ensure unread badge clears even if count is desynced
    let cancelled = false;

    const updateReadStatus = async () => {
      // Double check that groupId hasn't changed using ref
      if (cancelled || cachedGroupId !== currentGroupIdRef.current) {
        return;
      }

      const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', cachedGroupId);

      try {
        await setDoc(userGroupStateRef, {
          readMessageCount: cachedMessageCount,
          lastReadAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        if (!cancelled) {
          console.error("Error updating read status:", error);
        }
      }
    };

    updateReadStatus();

    return () => {
      cancelled = true;
    };
  }, [groupId, groupData, userData, isActive, initialScrollDone, messages.length]);

  // Track previous message count to only auto-scroll on new messages, not updates
  const prevMessageCountRef = useRef(0);

  // Scroll to bottom using the end ref
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    } else {
      // Fallback: try to scroll container directly
      const container = document.querySelector('.GroupChat');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  };

  // Scroll to first unread message
  const scrollToFirstUnread = (firstUnreadIndex) => {
    if (!containerRef.current) return false;
    const messageElements = containerRef.current.querySelectorAll('.message-wrapper, .message.system-message');

    if (messageElements[firstUnreadIndex]) {
      const element = messageElements[firstUnreadIndex];
      // Calculate position relative to container
      const container = containerRef.current;
      const elementTop = element.offsetTop;

      // Scroll exactly to that position minus header offset
      // Assuming container is positioned relative or simply scrolling content
      container.scrollTop = elementTop - 100; // 100px buffer for header

      return true;
    }
    return false;
  };

  // Handle initial scroll - use useLayoutEffect for synchronous execution after DOM updates
  useLayoutEffect(() => {
    // Wait until we have all messages loaded (compare with groupData.messageCount)
    const expectedMessageCount = groupData?.messageCount || 0;
    // If loading is finished and we have messages (or it's empty group), proceed.
    // Do NOT block on expectedMessageCount mismatch, as that causes deadlocks if counts are out of sync.
    if (userReadCount === null || loading) return;
    if (messages.length === 0 && expectedMessageCount > 0) return; // Still loading messages?


    // Initial scroll - go to first unread message or bottom
    if (!initialScrollDone) {
      let scrolled = false;

      // 1. Try to restore last viewed position from LocalStorage
      if (userData?.uid) {
        const lastViewedMsgId = localStorage.getItem(`last_viewed_msg_${groupId}_${userData.uid}`);
        if (lastViewedMsgId) {
          const targetEl = containerRef.current?.querySelector(`#message-${lastViewedMsgId}`);
          if (targetEl) {
            // Scroll to this element with a slight offset for context. 
            // We use 'auto' behavior for instant jump on load.
            const offset = 20;
            containerRef.current.scrollTop = targetEl.offsetTop - offset;
            scrolled = true;
          }
        }
      }

      // 2. If no saved position, try unread messages
      if (!scrolled) {
        // If there are unread messages
        if (userReadCount < messages.length) {
          scrolled = scrollToFirstUnread(userReadCount);
        }
      }

      // 3. Fallback to bottom
      if (!scrolled) {
        scrollToBottom();
      }

      setInitialScrollDone(true);
      prevMessageCountRef.current = messages.length;
    }
  }, [messages, userReadCount, loading, initialScrollDone, groupData?.messageCount, groupId, userData?.uid]);

  // Handle new messages - scroll to bottom ONLY if a new message arrived at the bottom
  useEffect(() => {
    if (!initialScrollDone || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const prevLastMsgId = latestMessageRef.current?.id;

    // If we have more messages than before AND the last message is different, it means a new message came in.
    if (messages.length > prevMessageCountRef.current) {
      if (lastMsg.id !== prevLastMsgId) {
        scrollToBottom();
      }
    }

    prevMessageCountRef.current = messages.length;
    latestMessageRef.current = lastMsg;
  }, [messages, initialScrollDone]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const handleShowMembers = async () => {
    setShowMobileMenu(false);
    setShowMembersModal(true);

    if (!groupData || !groupData.members || groupData.members.length === 0) {
      setMembersList([]);
      return;
    }

    setMembersLoading(true);
    try {
      const memberPromises = groupData.members.map(userId => getDoc(doc(db, 'users', userId)));
      const memberSnapshots = await Promise.all(memberPromises);

      const members = memberSnapshots.map(snap => {
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
        return { id: snap.id, nickname: 'Unknown User' };
      });

      setMembersList(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load members list");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleShowUnityModal = async () => {
    if (!groupData || !groupData.members) return;

    setShowUnityModal(true);

    const todayStr = new Date().toDateString();
    let postedUids = [];
    if (groupData.dailyActivity && groupData.dailyActivity.date === todayStr && groupData.dailyActivity.activeMembers) {
      postedUids = groupData.dailyActivity.activeMembers;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      const uniquePosters = new Set();
      messages.forEach(msg => {
        let msgTime = 0;
        if (msg.createdAt?.toDate) msgTime = msg.createdAt.toDate().getTime();
        else if (msg.createdAt?.seconds) msgTime = msg.createdAt.seconds * 1000;
        if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
          uniquePosters.add(msg.senderId);
        }
      });
      postedUids = Array.from(uniquePosters);
    }

    const notPostedUids = groupData.members.filter(uid => !postedUids.includes(uid));

    setMembersLoading(true);
    try {
      const allUids = Array.from(new Set([...postedUids, ...notPostedUids]));
      const missingUids = allUids.filter(uid => !membersList.some(m => m.id === uid));

      let updatedMembersList = [...membersList];
      if (missingUids.length > 0) {
        const memberPromises = missingUids.map(uid => getDoc(doc(db, 'users', uid)));
        const memberSnapshots = await Promise.all(memberPromises);
        const newMembers = memberSnapshots.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } : { id: snap.id, nickname: 'Unknown' });
        updatedMembersList = [...membersList, ...newMembers];
        setMembersList(updatedMembersList);
      }

      const posted = postedUids.map(uid => ({ id: uid, nickname: updatedMembersList.find(m => m.id === uid)?.nickname || 'Unknown' }));
      const notPosted = notPostedUids.map(uid => ({ id: uid, nickname: updatedMembersList.find(m => m.id === uid)?.nickname || 'Unknown' }));

      setUnityModalData({ posted, notPosted });
    } catch (error) {
      console.error("Error fetching unity modal data:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleUserProfileClick = async (userId) => {
    if (!userId || userId === 'system') return;

    // Check if we already have this user in our membersList
    const cachedMember = membersList.find(m => m.id === userId);
    if (cachedMember) {
      setSelectedMember(cachedMember);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setSelectedMember({ id: userDoc.id, ...userDoc.data() });
      } else {
        toast.error("User profile not found");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error("Failed to load user profile");
    }
  };

  const handleScroll = () => {
    // Check for load previous trigger
    if (initialScrollDone && containerRef.current) {
      if (containerRef.current.scrollTop === 0 && hasMoreOlder && !isLoadingOlder) {
        loadMoreOlderMessages();
      }
    }

    // Do not save scroll position if we are still initializing or loading older
    if (!initialScrollDone || isLoadingOlder) return;

    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);

    scrollDebounceRef.current = setTimeout(() => {
      if (!containerRef.current || !userData) return;
      const container = containerRef.current;
      const scrollTop = container.scrollTop;

      // Find the top-most visible message
      const messageElements = container.querySelectorAll('[id^="message-"]');
      let topMessageId = null;

      // We want to find the first message that is essentially "at the top" of the view
      // A message is at the top if its offsetTop is >= scrollTop
      for (const el of messageElements) {
        // 50px buffer to allow for partially scrolled messages
        if (el.offsetTop >= scrollTop - 50) {
          topMessageId = el.id.replace('message-', '');
          break;
        }
      }

      if (topMessageId) {
        localStorage.setItem(`last_viewed_msg_${groupId}_${userData.uid}`, topMessageId);
      }
    }, 200); // 200ms debounce
  };

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const newHeight = containerRef.current.scrollHeight;
      const diff = newHeight - previousScrollHeightRef.current;
      if (diff > 0) {
        containerRef.current.scrollTop = diff;
      }
      previousScrollHeightRef.current = 0;
    }
  }, [messages]);

  const loadMoreOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreOlder || messages.length === 0) return;

    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
    }

    setIsLoadingOlder(true);
    try {
      const oldestMsg = messages[0];
      if (!oldestMsg.createdAt) {
        setIsLoadingOlder(false);
        return;
      }

      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(oldestMsg.createdAt),
        limit(20)
      );

      const snaps = await getDocs(q);
      if (snaps.empty) {
        setHasMoreOlder(false);
        previousScrollHeightRef.current = 0;
      } else {
        const newOlderMsgs = snaps.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        setMessages(prev => [...newOlderMsgs, ...prev]);
      }
    } catch (e) {
      console.error("Error loading older messages", e);
      previousScrollHeightRef.current = 0;
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (newMessage.trim() === '' || !userData) return;

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    try {
      const messageData = {
        text: newMessage,
        createdAt: serverTimestamp(),
        senderId: userData.uid,
        senderNickname: userData.nickname,
        isNote: false,
        isEntry: false,
      };

      if (replyTo) {
        // For notes/entries, show a clean label instead of raw markdown
        let replyText;
        if (replyTo.isNote || replyTo.isEntry) {
          replyText = t('groupChat.studyNote');
        } else if (replyTo.text) {
          replyText = replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '');
        } else {
          replyText = 'Image/Note';
        }

        messageData.replyTo = {
          id: replyTo.id,
          senderNickname: replyTo.senderNickname,
          text: replyText,
          isNote: replyTo.isNote || replyTo.isEntry
        };
      }

      await addDoc(messagesRef, messageData);

      // Increment message count
      // Increment message count and update unity score data
      const groupRef = doc(db, 'groups', groupId);
      const updatePayload = {
        messageCount: increment(1),
        lastMessageAt: serverTimestamp()
      };

      await updateDoc(groupRef, updatePayload);

      setNewMessage('');
      setReplyTo(null);

      // Clear saved scroll position so next load goes to bottom (since we just sent a message, we are 'current')
      // OR keeps user preference. Usually standard chat apps jump to bottom on send.
      // We will clear it to force "catch up" behavior if they reload? 
      // Actually, if we send a message, we auto-scroll to bottom via useEffect.
      // It might be nice to clear the "bookmark" so next visit starts fresh or at bottom?
      // No, let the scroll listener update naturally.

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (e) {
      console.error("Error sending message:", e);
      toast.error(`Failed to send message: ${e.message || e}`);
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLeaveGroup = async () => {
    if (!userData || !groupId) return;
    if (isLeaving) return;

    setIsLeaving(true);

    try {
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch(`${API_BASE}/api/leave-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to leave group');
      }

      toast.success("You have left the group.");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error(`Failed to leave group: ${error.message}`);
    } finally {
      setShowLeaveModal(false);
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!userData || !groupId || !groupData) return;

    if (deleteConfirmationName !== groupData.name) {
      toast.error("Group name does not match.");
      return;
    }

    // Verify ownership
    if (groupData.ownerUserId !== userData.uid) {
      toast.error("Only the group owner can delete this group.");
      return;
    }

    try {
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch(`${API_BASE}/api/delete-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        // If it's a 404/not found, it might already be deleted, so we can treat as success or specific error
        if (response.status === 404) {
          toast.success("Group already deleted.");
          navigate('/dashboard');
          return;
        }
        throw new Error(text || 'Failed to delete group');
      }

      toast.success("Group deleted successfully.");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(`Failed to delete group: ${error.message}`);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!userData || !groupId || !groupData || !newGroupName.trim()) return;

    if (groupData.ownerUserId !== userData.uid) {
      toast.error("Only the group owner can change the group name.");
      return;
    }

    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim()
      });
      toast.success(t('groupChat.groupNameChanged'));
      setShowEditNameModal(false);
      setNewGroupName('');
      setNewGroupDescription('');
    } catch (error) {
      console.error("Error updating group name:", error);
      toast.error(t('groupChat.errorChangeGroupName'));
    }
  };

  const handleGenerateWeeklyRecap = async () => {
    if (!userData || !groupId) return;

    // Optional: Check if user is owner, or just let anyone generate for engagement (but maybe rate limit or only owner?)
    // For now, let's restrict to owner to avoid spamming system messages
    if (groupData?.ownerUserId !== userData.uid) {
      toast.error("Only the group owner can generate the weekly recap.");
      return;
    }

    toast.info("Generating weekly recap... This may take a moment.");
    setShowMobileMenu(false);

    try {
      const response = await fetch(`${API_BASE}/api/generate-weekly-recap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          language: language || 'en'
        })
      });

      if (response.status === 429) {
        toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to generate recap');
      }

      const data = await response.json();
      if (data.message && data.message.includes('No notes found')) {
        toast.info(t('groupChat.noNotesForRecap') || "No notes found for this week.");
      } else {
        toast.success("Weekly recap generated!");
      }

    } catch (error) {
      console.error("Error generating recap:", error);
      toast.error("Failed to generate weekly recap.");
    }
  };

  const handleKeyDown = (e) => {
    // User requested: Enter = Newline, Send = Click only (for Desktop)
    // Simply do nothing on Enter key, allowing default behavior (newline)
    // We can still support Shift+Enter for newline (default) or just Enter for newline (default)

    // If we want to strictly follow "Send ONLY on click", we just remove the keydown handler's submit logic.
    // However, usually "Enter" sends. The user specifically asked:
    // "desktop-viewの時Enterを押したら改行にするようにしてほしい。送信は送信ボタンをクリックしたときのみどうさするようにしてほしい"
    // (In desktop view, I want Enter to start a new line. I want sending to work ONLY when the send button is clicked.)

    // So we just don't handle submission here anymore. 
    // We might want to stop propagation if there was some existing form submission behavior, 
    // but since this is presumably a textarea, Enter naturally creates a newline.
    // We can just leave this empty or remove the block. 
    // But to be safe and explicit about the change:
    if (e.key === 'Enter') {
      // Allow default behavior (newline)
      e.stopPropagation();
    }
  };

  // Context menu handlers for own messages
  const handleContextMenu = (e, msg) => {
    if (msg.senderId !== userData?.uid) return; // Only for own messages
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      messageId: msg.id,
      message: msg
    });
  };

  const handleLongPressStart = (msg) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        show: true,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        messageId: msg.id,
        message: msg
      });
    }, 700); // 700ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.show]);

  const handleEditMessage = (msg) => {
    if (msg.isNote || msg.isEntry) {
      // For notes/entries, open NewNote modal in edit mode
      // We need to convert the message to a note-like object for NewNote
      setNoteToEdit({
        id: msg.id,
        text: msg.text,
        scripture: msg.scripture,
        chapter: msg.chapter,
        groupMessageId: msg.id, // Mark this as coming from group chat
        groupId: groupId
      });
      closeContextMenu();
    } else {
      // For regular messages, use the simple edit modal
      setEditingMessage(msg);
      setEditText(msg.text || '');
      closeContextMenu();
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', editingMessage.id);
      await updateDoc(messageRef, {
        text: editText,
        editedAt: serverTimestamp(),
        isEdited: true
      });

      setMessages(prev => prev.map(m =>
        m.id === editingMessage.id
          ? { ...m, text: editText, isEdited: true, editedAt: { seconds: Date.now() / 1000 } }
          : m
      ));

      toast.success(t('groupChat.messageEdited'));
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleDeleteMessageClick = (msg) => {
    setMessageToDelete(msg);
    setShowDeleteMessageModal(true);
    closeContextMenu();
  };

  const handleConfirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', messageToDelete.id);

      // Only delete the group message, NOT the personal note
      await deleteDoc(messageRef);

      // Decrement message count
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        messageCount: increment(-1),
        ...(messageToDelete.isNote ? { noteCount: increment(-1) } : {}) // Decrement noteCount if it was a note
      });

      setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));

      toast.success(t('groupChat.messageDeleted'));
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setMessageToDelete(null);
      setShowDeleteMessageModal(false);
    }
  };

  // Handle adding/removing reaction
  const handleToggleReaction = async (msg) => {
    if (!userData || !groupId) return;
    closeContextMenu();

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', msg.id);
      const reactions = msg.reactions || [];
      const existingReaction = reactions.find(r => r.odU === userData.uid);

      if (existingReaction) {
        // Remove reaction
        await updateDoc(messageRef, {
          reactions: arrayRemove(existingReaction)
        });

        // Optimistic Remove
        setMessages(prev => prev.map(m => {
          if (m.id === msg.id) {
            return { ...m, reactions: (m.reactions || []).filter(r => r.odU !== userData.uid) };
          }
          return m;
        }));

      } else {
        // Add reaction
        await updateDoc(messageRef, {
          reactions: arrayUnion({
            odU: userData.uid,
            nickname: userData.nickname,
            emoji: '👍'
          })
        });

        // Optimistic Add
        setMessages(prev => prev.map(m => {
          if (m.id === msg.id) {
            const newReactions = m.reactions ? [...m.reactions] : [];
            newReactions.push({ odU: userData.uid, nickname: userData.nickname, emoji: '👍' });
            return { ...m, reactions: newReactions };
          }
          return m;
        }));
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  // Show reactions modal
  const handleShowReactions = (reactions) => {
    setReactionsToShow(reactions || []);
    setShowReactionsModal(true);
  };

  // Helper function to translate scripture names
  const translateScriptureName = (scriptureName) => {
    const scriptureMapping = {
      'Old Testament': 'scriptures.oldTestament',
      'New Testament': 'scriptures.newTestament',
      'Book of Mormon': 'scriptures.bookOfMormon',
      'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
      'Doctrine and Convenants': 'scriptures.doctrineAndCovenants', // typo variant for legacy data
      'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
      'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
      // Also handle variations
      '旧約聖書': 'scriptures.oldTestament',
      '新約聖書': 'scriptures.newTestament',
      'モルモン書': 'scriptures.bookOfMormon',
      '教義と聖約': 'scriptures.doctrineAndCovenants',
      '高価な真珠': 'scriptures.pearlOfGreatPrice',
      'General Conference': 'scriptures.generalConference',
      '総大会': 'scriptures.generalConference',
      'Conferência Geral': 'scriptures.generalConference',
      '總會大會': 'scriptures.generalConference',
      'Conferencia General': 'scriptures.generalConference',
      'Đại Hội Trung Ương': 'scriptures.generalConference',
      'การประชุมใหญ่สามัญ': 'scriptures.generalConference',
      '연차 대회': 'scriptures.generalConference',
      'Pangkalahatang Kumperensya': 'scriptures.generalConference',
      'Mkutano Mkuu': 'scriptures.generalConference',
    };

    const translationKey = scriptureMapping[scriptureName];
    return translationKey ? t(translationKey) : scriptureName;
  };

  // Helper function to extract URLs from text
  const extractUrls = (text) => {
    if (!text) return [];
    const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    const matches = text.match(urlPattern);
    return matches || [];
  };

  // Helper function to render text with clickable links
  const renderTextWithLinks = (text, isSent) => {
    if (!text) return null;

    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

    const parts = text.split(urlPattern);

    return parts.map((part, index) => {
      if (urlPattern.test(part)) {
        // Reset the regex lastIndex
        urlPattern.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: isSent ? 'white' : '#0056b3',
              textDecoration: 'underline',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const formatNoteForDisplay = (text) => {
    if (!text) return '';
    let content = text;

    // Translate header
    const headerMatch = content.match(/^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/);
    let translatedHeader = '';
    if (headerMatch) {
      if (headerMatch[0].includes('New Study Note')) {
        translatedHeader = `📖 **${t('noteLabels.newStudyNote')}**\n\n`;
      } else {
        translatedHeader = `📖 **${t('noteLabels.newStudyEntry')}**\n\n`;
      }
    }

    let body = content.replace(/^(📖 \*\*New Study Note\*\*\n+|📖 \*\*New Study Entry\*\*\n+)/, '');

    // Match both English and various language formats
    const chapterMatch = body.match(/\*\*(?:Chapter|Title|Speech|章|タイトル|スピーチ|Capítulo|Título|章節|標題|Chương|Tiêu đề):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = body.match(/\*\*(?:Scripture|聖典|Escritura|經文|Thánh Thư):\*\* (.*?)(?:\n|$)/);

    // Handle "Other" category - no chapter field
    if (scriptureMatch && (scriptureMatch[1].trim() === 'Other' || scriptureMatch[1].trim() === 'その他')) {
      const scripture = t('scriptures.other');
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const comment = body.substring(scriptureEnd).trim();
      return `${translatedHeader}**${t('noteLabels.scripture')}:** ${scripture}\n\n**${t('noteLabels.comment')}:**\n${comment}`;
    }

    if (chapterMatch && scriptureMatch) {
      const rawChapter = chapterMatch[1].trim();
      const rawScripture = scriptureMatch[1].trim();
      const chapter = translateChapterField(rawChapter, language);
      const scripture = translateScriptureName(rawScripture);

      // Check if scripture is General Conference to use appropriate label
      const gcVariants = ['General Conference', '総大会', 'Conferência Geral', '總會大會', 'Conferencia General', 'Đại Hội Trung Ương', 'การประชุมใหญ่สามัญ', '연차 대회', 'Pangkalahatang Kumperensya', 'Mkutano Mkuu'];
      const isGC = gcVariants.includes(rawScripture);
      let chapterLabel = isGC ? t('noteLabels.talk') : t('noteLabels.chapter');

      if (rawScripture === 'BYU Speeches') {
        chapterLabel = t('noteLabels.speech');
      } else if (chapterMatch[0].includes('Title')) {
        chapterLabel = t('noteLabels.title');
      }

      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;
      const maxEnd = Math.max(chapterEnd, scriptureEnd);

      const comment = body.substring(maxEnd).trim();

      return `${translatedHeader}**${t('noteLabels.scripture')}:** ${scripture}\n**${chapterLabel}:** ${chapter}\n\n**${t('noteLabels.comment')}:**\n${comment}`;
    }

    // If no structured format found, just translate the labels in the raw text
    return content
      .replace(/\*\*Scripture:\*\*/g, `**${t('noteLabels.scripture')}:**`)
      .replace(/\*\*Chapter:\*\*/g, `**${t('noteLabels.chapter')}:**`)
      .replace(/\*\*Speech:\*\*/g, `**${t('noteLabels.speech')}:**`)
      .replace(/\*\*Title:\*\*/g, `**${t('noteLabels.title')}:**`)
      .replace(/📖 \*\*New Study Note\*\*/g, `📖 **${t('noteLabels.newStudyNote')}**`)
      .replace(/📖 \*\*New Study Entry\*\*/g, `📖 **${t('noteLabels.newStudyEntry')}**`);
  };

  const togglePublicStatus = async () => {
    if (!groupData || !groupId) return;
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        isPublic: !groupData.isPublic
      });
      toast.success(`Group is now ${!groupData.isPublic ? 'Public' : 'Private'}`);
    } catch (error) {
      console.error("Error updating group status:", error);
      toast.error("Failed to update group status");
    }
  };


  const handleCopyInviteLink = () => {
    if (groupData && groupData.inviteCode) {
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/join/${groupData.inviteCode}`;
      navigator.clipboard.writeText(inviteLink);
      toast.success(t('groupChat.inviteLinkCopied'));
    }
  };

  /* 
   * Check if weekly recap is available (7 day cooldown)
   */
  const getLastRecapDate = () => {
    if (groupData?.lastRecapGeneratedAt?.toDate) {
      return groupData.lastRecapGeneratedAt.toDate();
    }
    // Handle specific case where it might be a raw timestamp object (if not converted by Firestore SDK yet in some edge cases)
    if (groupData?.lastRecapGeneratedAt?.seconds) {
      return new Date(groupData.lastRecapGeneratedAt.seconds * 1000);
    }
    return null;
  };

  const lastRecapDate = getLastRecapDate();
  const daysSinceLastRecap = lastRecapDate
    ? (new Date() - lastRecapDate) / (1000 * 60 * 60 * 24)
    : 100; // if never generated, treat as long time ago

  const isRecapAvailable = daysSinceLastRecap >= 7;

  const handleRecapClick = (e) => {
    if (!isRecapAvailable) {
      e.stopPropagation();
      toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
      setIsRecapLoading(false); // Ensure loading state is off if somehow on
      return;
    }
    handleGenerateWeeklyRecap();
  };

  const isAnyModalOpen = showLeaveModal || showDeleteModal || showDeleteMessageModal || editingMessage || showReactionsModal || isNewNoteOpen || noteToEdit || showEditNameModal || showMembersModal || showUnityModal || showInviteModal;

  // Calculate Unity Score (Percentage of members who posted today)
  const unityPercentage = useMemo(() => {
    // Safety check: Ensure the groupData belongs to the current groupId to prevent stale data usage on switch
    if (!groupData?.members || groupData.members.length === 0 || groupData?._groupId !== groupId) return 0;

    const todayStr = new Date().toDateString();
    let uniquePostersCount = 0;

    // PRIMARY SOURCE: dailyActivity from Firestore (This matches Sidebar)
    if (groupData.dailyActivity && groupData.dailyActivity.date === todayStr && groupData.dailyActivity.activeMembers) {
      uniquePostersCount = groupData.dailyActivity.activeMembers.length;
    } else {
      // FALLBACK: Calculate locally (only if no server data for today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      const uniquePosters = new Set();

      messages.forEach(msg => {
        // Check if message is from today
        let msgTime = 0;
        if (msg.createdAt?.toDate) {
          msgTime = msg.createdAt.toDate().getTime();
        } else if (msg.createdAt?.seconds) {
          msgTime = msg.createdAt.seconds * 1000;
        }

        // Filter out system messages and ensure it is a NOTE
        if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
          uniquePosters.add(msg.senderId);
        }
      });
      uniquePostersCount = uniquePosters.size;
    }

    const score = Math.round((uniquePostersCount / groupData.members.length) * 100);
    return Math.min(100, Math.max(0, score));
  }, [messages, groupData, groupId]);

  // Synchronize Daily Activity Data (for Sidebar accuracy)
  useEffect(() => {
    if (!groupData || groupData._groupId !== groupId || !messages) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const todayStr = today.toDateString();

    const uniquePosters = new Set();
    messages.forEach(msg => {
      let msgTime = 0;
      if (msg.createdAt?.toDate) {
        msgTime = msg.createdAt.toDate().getTime();
      } else if (msg.createdAt?.seconds) {
        msgTime = msg.createdAt.seconds * 1000;
      }
      if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
        uniquePosters.add(msg.senderId);
      }
    });

    // Check against Firestore data
    const currentActivity = groupData.dailyActivity || {};
    const recordedMembers = (currentActivity.date === todayStr && currentActivity.activeMembers)
      ? new Set(currentActivity.activeMembers)
      : new Set();

    // Find missing members (present in local calculation but missing in Firestore)
    const missingMembers = [...uniquePosters].filter(uid => !recordedMembers.has(uid));

    if (missingMembers.length > 0) {
      const groupRef = doc(db, 'groups', groupId);
      const updatePayload = {};

      if (currentActivity.date !== todayStr) {
        // New day (or overwrite stale data)
        updatePayload.dailyActivity = {
          date: todayStr,
          activeMembers: Array.from(uniquePosters)
        };
      } else {
        // Add only missing members
        updatePayload['dailyActivity.activeMembers'] = arrayUnion(...missingMembers);
      }

      updateDoc(groupRef, updatePayload).catch(err => console.error("Error syncing daily activity:", err));
    }
  }, [messages, groupData, groupId]);

  // Track previous percentage to trigger effect only on change
  useEffect(() => {
    if (!userData?.uid || !groupId) return;

    if (unityPercentage === 100) {
      const todayStr = new Date().toDateString();
      const storageKey = `unity_firework_${groupId}_${userData.uid}`;
      const lastSeen = localStorage.getItem(storageKey);

      if (lastSeen !== todayStr) {
        // Fire confetti!
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          // since particles fall down, start a bit higher than random
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Mark as seen for today
        localStorage.setItem(storageKey, todayStr);

        // EXTRA: Send a system message to the chat if not already sent today
        // Use group-level tracking to prevent duplicates from multiple users
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        const groupRef = doc(db, 'groups', groupId);

        // Check if announcement was already sent today at group level
        const checkAndSendAnnouncement = async () => {
          try {
            const groupSnap = await getDoc(groupRef);
            const lastAnnouncementDate = groupSnap.data()?.lastUnityAnnouncementDate;

            // If no announcement was sent today, send one
            if (lastAnnouncementDate !== todayStr) {
              // Add the message
              await addDoc(messagesRef, {
                senderId: 'system',
                isSystemMessage: true,
                messageType: 'unityAnnouncement',
                createdAt: serverTimestamp()
              });

              // Update the group's last announcement date
              await updateDoc(groupRef, {
                lastUnityAnnouncementDate: todayStr
              });
            }
          } catch (err) {
            console.error("Error sending unity announcement:", err);
          }
        };

        checkAndSendAnnouncement();
      }
    }
  }, [unityPercentage, groupId, userData?.uid]);

  return (
    <div className="GroupChat" >
      <NewNote
        isOpen={isNewNoteOpen || noteToEdit !== null}
        onClose={() => {
          setIsNewNoteOpen(false);
          setNoteToEdit(null);
        }}
        userData={userData}
        isGroupContext={true}
        userGroups={userGroups}
        currentGroupId={groupId}
        noteToEdit={noteToEdit}
      />
      <div className="chat-header">
        <div className="header-left">
          {onBack && (
            <div className="back-button" onClick={onBack}>
              <UilArrowLeft size="24" />
            </div>
          )}
          <h2 style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span className="group-name-text" title={groupData ? groupData.name : t('groupChat.groupName')}>
              {groupData ? groupData.name : t('groupChat.groupName')}
            </span>
            {groupData?.ownerUserId === userData?.uid && (
              <button
                className="edit-group-name-btn"
                onClick={() => {
                  setNewGroupName(groupData.name);
                  setNewGroupDescription(groupData.description || '');
                  setShowEditNameModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gray)',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                  flexShrink: 0
                }}
                title={t('groupChat.changeGroupName')}
              >
                <UilPen size="18" />
              </button>
            )}
            {groupData?.members && <span className="member-count-badge" style={{ flexShrink: 0 }}>({groupData.members.length})</span>}
            {groupData && (
              <div className="unity-score-container">
                <span
                  className={`unity-score-badge ${unityPercentage === 100 ? 'celestial' : ''}`}
                  onClick={handleShowUnityModal}
                  title="Unity Score: members active today"
                >
                  <span className="unity-icon">
                    {unityPercentage === 100 ? '☀️' :
                      unityPercentage >= 66 ? '🌕' :
                        unityPercentage >= 33 ? '🌠' :
                          '🌑'}
                  </span>
                  <span className="unity-percent-text">{unityPercentage}%</span>
                </span>
              </div>
            )}

          </h2>
        </div>
        {groupData && (
          <>
            {/* Desktop header - hidden on mobile */}
            <div className="header-right desktop-only">
              {isOwner && (
                <div className="group-status-toggle">
                  <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={groupData.isPublic || false}
                      onChange={togglePublicStatus}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}
              <div className="invite-code-wrapper">
                <div className="invite-code-display" onClick={() => setShowInviteModal(true)} title={t('groupChat.inviteLink')}>
                  <span>{t('groupChat.inviteLink')}</span>
                  <UilCopy size="16" className="copy-icon" />
                </div>
              </div>

              <div className="invite-code-display members-btn-desktop" onClick={handleShowMembers} title={t('groupChat.members')}>
                <UilUsersAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>

              {isOwner && (
                <div
                  className={`invite-code-display members-btn-desktop ${!isRecapAvailable ? 'disabled' : ''}`}
                  onClick={handleRecapClick}
                  title={!isRecapAvailable ? (t('groupChat.recapRateLimit') || "Weekly recap available next week") : (t('groupChat.generateWeeklyRecap') || "Weekly Recap")}
                  style={{
                    marginRight: '8px',
                    opacity: !isRecapAvailable ? 0.5 : 1,
                    cursor: !isRecapAvailable ? 'not-allowed' : 'pointer'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📊</span>
                  {isRecapLoading && <div className="spinner-mini"></div>}
                </div>
              )}

              {isOwner ? (
                <button className="leave-group-btn delete-group-btn" onClick={() => setShowDeleteModal(true)} title={t('groupChat.deleteGroup')}>
                  <UilTrashAlt size="20" />
                </button>
              ) : (
                <button className="leave-group-btn" onClick={() => setShowLeaveModal(true)} title={t('groupChat.leaveGroup')}>
                  <UilSignOutAlt size="20" />
                </button>
              )}
            </div>

            {/* Mobile hamburger menu button */}
            <div className="hamburger-container mobile-only">
              {groupData.members.length === 1 && (
                <div className="header-invite-btn-mobile" onClick={() => setShowInviteModal(true)} title={t('groupChat.inviteLink')}>
                  <span style={{ fontSize: '1.2rem' }}>🎁</span>
                </div>
              )}
              <button
                className="hamburger-btn"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                aria-label="Menu"
              >
                <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu overlay - placed outside chat-header for proper positioning */}
      {showMobileMenu && groupData && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h3>{groupData.name}</h3>
              <button className="close-menu-btn" onClick={() => setShowMobileMenu(false)}>
                <UilTimes size="24" />
              </button>
            </div>

            <div className="mobile-menu-content">
              {/* Invite Link Section */}
              <div className="mobile-menu-item invite-section" onClick={() => { setShowInviteModal(true); setShowMobileMenu(false); }}>
                <div className="menu-item-icon">
                  <UilCopy size="20" />
                </div>
                <div className="menu-item-content">
                  <span className="menu-item-label">{t('groupChat.inviteLink')}</span>
                </div>
              </div>

              {/* Public/Private Toggle (Owner only) */}
              {isOwner && (
                <div className="mobile-menu-item toggle-section">
                  <div className="menu-item-content">
                    <span className="menu-item-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={groupData.isPublic || false}
                      onChange={() => { togglePublicStatus(); }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}

              {/* Change Group Name (Owner only) */}
              {isOwner && (
                <div className="mobile-menu-item" onClick={() => {
                  setNewGroupName(groupData.name);
                  setNewGroupDescription(groupData.description || '');
                  setShowMobileMenu(false);
                  setShowEditNameModal(true);
                }}>
                  <div className="menu-item-icon">
                    <UilPen size="20" />
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-label">{t('groupChat.changeGroupName')}</span>
                  </div>
                </div>
              )}

              {/* Members List Item */}
              <div className="mobile-menu-item" onClick={handleShowMembers}>
                <div className="menu-item-icon">
                  <UilUsersAlt size="20" />
                </div>
                <div className="menu-item-content">
                  <span className="menu-item-label">{t('groupChat.members')}</span>
                </div>
              </div>

              <div className="mobile-menu-divider"></div>

              {/* Weekly Recap - Owner Only */}
              {isOwner && (
                <div
                  className={`mobile-menu-item ${!isRecapAvailable ? 'disabled' : ''}`}
                  onClick={(e) => {
                    if (!isRecapAvailable) {
                      e.stopPropagation();
                      toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
                    } else {
                      handleGenerateWeeklyRecap();
                    }
                  }}
                  style={{
                    opacity: !isRecapAvailable ? 0.5 : 1,
                    cursor: !isRecapAvailable ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="menu-item-icon">
                    <span style={{ fontSize: '1.2rem' }}>📊</span>
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-label">{t('groupChat.generateWeeklyRecap') || "Weekly Recap"}</span>
                    {!isRecapAvailable && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--red)' }}>
                        {Math.ceil(7 - daysSinceLastRecap) > 0
                          ? (t('groupChat.daysLeft') || "{days} days left").replace('{days}', Math.ceil(7 - daysSinceLastRecap))
                          : (t('groupChat.availableSoon') || "Available soon")}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mobile-menu-divider"></div>

              {/* Leave/Delete Group */}
              {isOwner ? (
                <div
                  className="mobile-menu-item danger"
                  onClick={() => { setShowMobileMenu(false); setShowDeleteModal(true); }}
                >
                  <div className="menu-item-icon">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.deleteGroup')}</span>
                </div>
              ) : (
                <div
                  className="mobile-menu-item danger"
                  onClick={() => { setShowMobileMenu(false); setShowLeaveModal(true); }}
                >
                  <div className="menu-item-icon">
                    <UilSignOutAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.leaveGroup')}</span>
                </div>
              )}

              {/* Group List Section */}
              <div className="mobile-menu-divider"></div>
              <div className="mobile-menu-section-title" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', color: 'var(--gray)', fontWeight: '600' }}>
                My Groups
              </div>
              <div className="mobile-groups-list">
                {userGroups.map((group) => {
                  const getEmoji = (g) => {
                    let percentage = 0;
                    if (g && g.members && g.members.length > 0) {
                      const todayStr = new Date().toDateString();
                      if (g.dailyActivity && g.dailyActivity.date === todayStr && g.dailyActivity.activeMembers) {
                        const uniqueCount = new Set(g.dailyActivity.activeMembers).size;
                        percentage = Math.round((uniqueCount / g.members.length) * 100);
                      }
                    }

                    if (percentage === 100) return '☀️';
                    if (percentage >= 66) return '🌕';
                    if (percentage >= 33) return '🌠';
                    return '🌑';
                  };

                  return (
                    <div
                      key={group.id}
                      className={`mobile-menu-item ${group.id === groupId ? 'active' : ''}`}
                      onClick={() => {
                        onGroupSelect && onGroupSelect(group.id);
                        setShowMobileMenu(false);
                      }}
                      style={group.id === groupId ? { background: 'rgba(255, 145, 157, 0.1)', color: 'var(--pink)' } : {}}
                    >
                      <div className="menu-item-icon" style={group.id === groupId ? { color: 'var(--pink)' } : {}}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{getEmoji(group)}</span>
                      </div>
                      <span className="menu-item-label" style={group.id === groupId ? { fontWeight: 'bold' } : {}}>
                        {group.name} {group.members && <span style={{ fontSize: '0.85em', color: group.id === groupId ? 'var(--pink)' : 'var(--gray)', opacity: 0.8, fontWeight: 'normal', marginLeft: '4px' }}>({group.members.length})</span>}
                      </span>
                      {group.unreadCount > 0 && (
                        <span style={{
                          background: 'var(--pink)',
                          color: 'white',
                          borderRadius: '50%',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          marginLeft: 'auto',
                          minWidth: '20px',
                          textAlign: 'center'
                        }}>
                          {group.unreadCount > 99 ? '99+' : group.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {userGroups.length < 12 && (
                <>
                  <div className="mobile-menu-divider"></div>
                  <div
                    className="mobile-menu-item"
                    onClick={() => {
                      navigate('/group-options');
                      setShowMobileMenu(false);
                    }}
                  >
                    <div className="menu-item-icon">
                      <UilPlusCircle size="20" />
                    </div>
                    <span className="menu-item-label">{t('sidebar.joinCreateGroup')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )
      }

      {
        showLeaveModal && (
          <div className="leave-modal-overlay">
            <div className="leave-modal-content">
              <h3>{t('groupChat.leaveGroup')}?</h3>
              <p>{t('groupChat.leaveConfirmMessage')}</p>
              <div className="leave-modal-actions">
                <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)} disabled={isLeaving}>{t('groupChat.cancel')}</button>
                <button className="modal-btn leave" onClick={handleLeaveGroup} disabled={isLeaving}>
                  {isLeaving ? '...' : t('groupChat.confirmLeave')}
                </button>
              </div>
            </div>
          </div>
        )
      }



      {/* Welcome Guide Modal */}
      {
        showWelcomeGuide && (
          <div className="leave-modal-overlay guide-modal-overlay">
            <div className="leave-modal-content guide-modal-content">
              <div className="guide-image-container">
                <img src="/images/mascot.png" alt="Welcome Bird" className="guide-bird-image" />
              </div>
              <h3>{t('groupChat.welcomeGuideTitle')}</h3>
              <p className="guide-intro">{t('groupChat.welcomeGuideMessage')}</p>

              <div className="guide-rule-box">
                <h4 className="guide-rule-title">{t('groupChat.welcomeGuideRule')}</h4>
                <p className="guide-rule-detail">{t('groupChat.welcomeGuideRuleDetail')}</p>
              </div>

              <button className="modal-btn guide-btn" onClick={handleDismissWelcomeGuide}>
                {t('groupChat.welcomeGuideButton')}
              </button>
            </div>
          </div>
        )
      }

      {
        showDeleteModal && (
          <div className="leave-modal-overlay">
            <div className="leave-modal-content">
              <h3 className="delete-modal-title">{t('groupChat.deleteGroup')}?</h3>
              <p>{t('groupChat.deleteConfirmMessage')}</p>
              <div style={{ marginBottom: '1rem' }}>
                <ReactMarkdown components={{ p: 'span' }}>
                  {t('groupChat.typeToConfirm').replace('{groupName}', groupData.name)}
                </ReactMarkdown>
              </div>
              <input
                type="text"
                className="delete-confirmation-input"
                value={deleteConfirmationName}
                onChange={(e) => setDeleteConfirmationName(e.target.value)}
                placeholder={t('groupChat.enterGroupNamePlaceholder')}
              />
              <div className="leave-modal-actions">
                <button className="modal-btn cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmationName(''); }}>{t('groupChat.cancel')}</button>
                <button
                  className="modal-btn leave"
                  onClick={handleDeleteGroup}
                  disabled={deleteConfirmationName !== groupData?.name}
                >
                  {t('groupChat.confirmDelete')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showEditNameModal && (
          <div className="leave-modal-overlay">
            <div className="leave-modal-content edit-group-modal">
              <h3>{t('groupChat.changeGroupName')}</h3>

              <div className="edit-group-field" style={{ width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                  {t('groupForm.groupNameLabel')}
                </label>
                <input
                  type="text"
                  className="delete-confirmation-input"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t('groupChat.enterNewGroupName')}
                  style={{ marginBottom: '1rem' }}
                />
              </div>

              <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                  {t('groupForm.descriptionLabel')}
                </label>
                <textarea
                  className="delete-confirmation-input"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder={t('groupForm.descriptionLabel')}
                  style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                />
              </div>

              <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                <button className="modal-btn cancel" onClick={() => { setShowEditNameModal(false); setNewGroupName(''); setNewGroupDescription(''); }}>{t('groupChat.cancel')}</button>
                <button
                  className="modal-btn primary"
                  onClick={handleUpdateGroupName}
                  disabled={!newGroupName.trim() || (newGroupName === groupData?.name && newGroupDescription === (groupData?.description || ''))}
                >
                  {t('groupChat.save')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {showInactivityPolicyBanner && (
        <div className="inactivity-policy-banner">
          <span>{t('groupChat.inactivityPolicyBanner')}</span>
          <button className="inactivity-policy-dismiss" onClick={handleDismissInactivityBanner}>
            <UilTimes size="16" />
          </button>
        </div>
      )}

      <div
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        onClick={() => {
          if (textareaRef.current) {
            textareaRef.current.blur();
          }
        }}
      >


        {loading && <p>Loading messages...</p>}
        {isLoadingOlder && (
          <div className="loading-older-messages" style={{ textAlign: 'center', padding: '10px', color: 'var(--gray)' }}>
            <i className="spinner-mini"></i>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const currentDate = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date();
          const prevDate = prevMsg?.createdAt?.seconds ? new Date(prevMsg.createdAt.seconds * 1000) : null;

          let showDateSeparator = false;
          if (!prevDate) {
            showDateSeparator = true;
          } else if (currentDate.toDateString() !== prevDate.toDateString()) {
            showDateSeparator = true;
          }

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="date-separator">
                  <span>{currentDate.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
                </div>
              )}
              {msg.senderId === 'system' || msg.isSystemMessage ? (
                <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''}`}>
                  <div className="message-content">
                    {msg.messageType === 'unityAnnouncement' && (
                      <div className="unity-announcement-body">
                        <img src="/images/mascot.png" alt="Mascot" className="mascot-avatar-celestial" />
                      </div>
                    )}
                    <ReactMarkdown>
                      {(() => {
                        // New format: has messageType and messageData
                        if (msg.messageType === 'streakAnnouncement' && msg.messageData) {
                          return t('groupChat.streakAnnouncement')
                            .replace('{nickname}', msg.messageData.nickname)
                            .replace('{streak}', msg.messageData.streak);
                        }

                        if (msg.messageType === 'userJoined' && msg.messageData) {
                          return t('groupChat.userJoined')
                            .replace('{nickname}', msg.messageData.nickname);
                        }

                        if (msg.messageType === 'userLeft' && msg.messageData) {
                          return t('groupChat.userLeft')
                            .replace('{nickname}', msg.messageData.nickname);
                        }

                        if (msg.messageType === 'unityAnnouncement') {
                          return t('groupChat.unityAnnouncement');
                        }

                        if (msg.messageType === 'weeklyRecap') {
                          // Just return text, maybe bold the title if we want, but markdown handles it.
                          // The text comes with "Weekly Reflection: ..." or similar
                          return msg.text;
                        }

                        // Legacy format: parse from text
                        // Streak patterns for various languages:
                        const streakPatterns = [
                          /\*\*(.+?) reached a (\d+) day streak/,           // English
                          /\*\*(.+?)さんが(\d+)日連続ストリーク/,            // Japanese
                          /\*\*(.+?) alcançou uma ofensiva de (\d+) dias/, // Portuguese
                          /\*\*(.+?) 達成了 (\d+) 天連續紀錄/,              // Chinese
                          /\*\*(.+?) alcanzó una racha de (\d+) días/,     // Spanish
                          /\*\*(.+?) đã đạt chuỗi (\d+) ngày/,             // Vietnamese
                        ];

                        for (const pattern of streakPatterns) {
                          const match = msg.text?.match(pattern);
                          if (match) {
                            const nickname = match[1];
                            const streak = match[2];
                            return t('groupChat.streakAnnouncement')
                              .replace('{nickname}', nickname)
                              .replace('{streak}', streak);
                          }
                        }

                        // Legacy join patterns
                        const joinPatterns = [
                          /\*\*(.+?)\*\* joined the group/,      // English
                          /\*\*(.+?)\*\*さんがグループに参加/,    // Japanese
                          /\*\*(.+?)\*\* entrou no grupo/,       // Portuguese
                          /\*\*(.+?)\*\* 加入了群組/,            // Chinese
                          /\*\*(.+?)\*\* se unió al grupo/,      // Spanish
                          /\*\*(.+?)\*\* đã tham gia nhóm/,      // Vietnamese
                        ];

                        for (const pattern of joinPatterns) {
                          const match = msg.text?.match(pattern);
                          if (match) {
                            return t('groupChat.userJoined').replace('{nickname}', match[1]);
                          }
                        }

                        // Legacy leave patterns
                        const leavePatterns = [
                          /\*\*(.+?)\*\* left the group/,        // English
                          /\*\*(.+?)\*\*さんがグループを退会/,    // Japanese
                          /\*\*(.+?)\*\* saiu do grupo/,         // Portuguese
                          /\*\*(.+?)\*\* 離開了群組/,            // Chinese
                          /\*\*(.+?)\*\* salió del grupo/,       // Spanish
                          /\*\*(.+?)\*\* đã rời nhóm/,           // Vietnamese
                        ];

                        for (const pattern of leavePatterns) {
                          const match = msg.text?.match(pattern);
                          if (match) {
                            return t('groupChat.userLeft').replace('{nickname}', match[1]);
                          }
                        }

                        // No match found, return original text
                        return msg.text;
                      })()}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div id={`message-${msg.id}`} className={`message-wrapper ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
                  <div
                    className={`message ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}
                    onTouchStart={() => handleLongPressStart(msg)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchMove={handleLongPressEnd}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover action buttons */}
                    <div className={`message-hover-actions ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
                      {msg.senderId === userData?.uid ? (
                        <>
                          <button
                            className="hover-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                            title={t('groupChat.editMessage')}
                          >
                            ✏️
                          </button>
                          <button
                            className="hover-action-btn delete"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMessageClick(msg); }}
                            title={t('groupChat.deleteMessage')}
                          >
                            🗑️
                          </button>
                          <button
                            className="hover-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                            title={t('groupChat.reply')}
                          >
                            ↩️
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="hover-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg); }}
                            title={msg.reactions?.find(r => r.odU === userData?.uid) ? t('groupChat.unlike') : t('groupChat.like')}
                          >
                            {msg.reactions?.find(r => r.odU === userData?.uid) ? '👍' : '👍'}
                          </button>
                          <button
                            className="hover-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                            title={t('groupChat.reply')}
                          >
                            ↩️
                          </button>
                        </>
                      )}
                    </div>
                    <span
                      className="sender-name"
                      onClick={(e) => { e.stopPropagation(); handleUserProfileClick(msg.senderId); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {msg.senderNickname}{msg.isEdited && <span className="edited-indicator"> ({t('groupChat.messageEdited')})</span>}
                    </span>
                    <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
                      {msg.senderId === userData?.uid && (
                        <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                          {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      )}
                      <div className="message-bubble-column" style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', alignItems: msg.senderId === userData?.uid ? 'flex-end' : 'flex-start' }}>
                        {msg.replyTo && (
                          <div className="reply-context-label">
                            <span className="reply-context-prefix">{t('groupChat.replyTo')} </span>
                            <span className="reply-context-name">{msg.replyTo.senderNickname}</span>
                            <span className="reply-context-separator">: </span>
                            <span className="reply-context-text">
                              {msg.replyTo.isNote || msg.replyTo.text?.startsWith('📖 **New Study') || msg.replyTo.text?.startsWith('**New Study')
                                ? t('groupChat.studyNote')
                                : msg.replyTo.text
                              }
                            </span>
                          </div>
                        )}
                        <div className="message-content">
                          {msg.text && (
                            (msg.isNote || msg.isEntry) ? (
                              <div className="entry-message-content">
                                <NoteDisplay text={msg.text} isSent={msg.senderId === userData?.uid} />
                                <div style={{ marginTop: '0.2rem' }}></div>
                                {(() => {
                                  // Update regex to find chapter OR title OR speech
                                  const chapterMatch = msg.text.match(/\*\*(?:Chapter|Title|Speech):\*\* (.*?)(?:\n|$)/);
                                  const scriptureMatch = msg.text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

                                  // Handle "Other" category - use stored chapter as URL
                                  if (scriptureMatch) {
                                    const scripture = scriptureMatch[1].trim();
                                    if (scripture === 'Other' && msg.chapter) {
                                      return (
                                        <a
                                          href={msg.chapter}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className={`gospel-link ${msg.senderId === userData?.uid ? 'sent' : ''}`}
                                        >
                                          {t('dashboard.readStudyMaterial')}
                                        </a>
                                      );
                                    }
                                  }

                                  if (chapterMatch && scriptureMatch) {
                                    const scripture = scriptureMatch[1].trim();
                                    const chapter = chapterMatch[1].trim();
                                    const url = getGospelLibraryUrl(scripture, chapter, language);
                                    if (url) {
                                      return (
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className={`gospel-link ${msg.senderId === userData?.uid ? 'sent' : ''}`}
                                        >
                                          {scripture === 'BYU Speeches' ? t('dashboard.goToByuSpeech') : t('dashboard.readInGospelLibrary')}
                                        </a>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <p>{renderTextWithLinks(msg.text, msg.senderId === userData?.uid)}</p>
                            )
                          )}
                          {/* Show link previews for regular messages with URLs */}
                          {!msg.isNote && !msg.isEntry && extractUrls(msg.text).slice(0, 1).map((url, idx) => (
                            <LinkPreview key={idx} url={url} isSent={msg.senderId === userData?.uid} />
                          ))}
                        </div>
                      </div>
                      {msg.senderId !== userData?.uid && (
                        <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                          {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      )}
                    </div>
                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div
                        className={`message-reactions ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowReactions(msg.reactions);
                        }}
                      >
                        <span className="reaction-emoji">👍</span>
                        <span className="reaction-count">{msg.reactions.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {/* Scroll target at the end of messages */}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu for messages */}
      {
        contextMenu.show && (
          <div
            className="message-context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              transform: 'translate(-50%, -50%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.message?.senderId === userData?.uid ? (
              <>
                <button onClick={() => handleEditMessage(contextMenu.message)}>
                  ✏️ {t('groupChat.editMessage')}
                </button>
                <button onClick={() => handleDeleteMessageClick(contextMenu.message)} className="delete-option">
                  🗑️ {t('groupChat.deleteMessage')}
                </button>
                <button onClick={() => { handleReply(contextMenu.message); closeContextMenu(); }}>
                  ↩️ Reply
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleToggleReaction(contextMenu.message)}>
                  {contextMenu.message?.reactions?.find(r => r.odU === userData?.uid) ? '👎 Unlike' : '👍 Like'}
                </button>
                <button onClick={() => { handleReply(contextMenu.message); closeContextMenu(); }}>
                  ↩️ Reply
                </button>
              </>
            )}
          </div>
        )
      }

      {/* Delete Message Confirmation Modal */}
      {
        showDeleteMessageModal && (
          <div className="leave-modal-overlay">
            <div className="leave-modal-content" style={{ maxWidth: '360px' }}>
              <h3>{t('groupChat.deleteMessageConfirm')}</h3>
              {(messageToDelete?.isNote || messageToDelete?.isEntry) && messageToDelete?.originalNoteId && (
                <p style={{ color: '#ff9800', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  ⚠️ {t('groupChat.deleteMessageWarning')}
                </p>
              )}
              <div className="leave-modal-actions">
                <button className="modal-btn cancel" onClick={() => { setShowDeleteMessageModal(false); setMessageToDelete(null); }}>
                  {t('groupChat.cancel')}
                </button>
                <button className="modal-btn leave" onClick={handleConfirmDeleteMessage}>
                  {t('groupChat.deleteMessage')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Message Modal */}
      {
        editingMessage && (
          <div className="leave-modal-overlay">
            <div className="leave-modal-content edit-message-modal">
              <h3>{t('groupChat.editMessage')}</h3>
              <textarea
                className="edit-message-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
              />
              <div className="leave-modal-actions">
                <button className="modal-btn cancel" onClick={handleCancelEdit}>
                  {t('groupChat.cancel')}
                </button>
                <button className="modal-btn leave" onClick={handleSaveEdit} style={{ background: 'var(--pink)' }}>
                  {t('groupChat.editMessage')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Reactions Modal */}
      {
        showReactionsModal && (
          <div className="leave-modal-overlay" onClick={() => setShowReactionsModal(false)}>
            <div className="leave-modal-content reactions-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
              <h3>👍 Reactions</h3>
              <div className="reactions-list">
                {reactionsToShow.map((reaction, idx) => (
                  <div
                    key={idx}
                    className="reaction-user"
                    onClick={() => handleUserProfileClick(reaction.odU)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="reaction-user-emoji">👍</span>
                    <span className="reaction-user-name">{reaction.nickname}</span>
                  </div>
                ))}
              </div>
              <div className="leave-modal-actions">
                <button className="modal-btn cancel" onClick={() => setShowReactionsModal(false)}>
                  {t('groupChat.cancel')}
                </button>
              </div>
            </div>
          </div>
        )
      }



      {/* Members List Modal */}
      {
        showMembersModal && (
          <div className="leave-modal-overlay" onClick={() => setShowMembersModal(false)}>
            <div className="leave-modal-content members-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('groupChat.groupMembers')} ({membersList.length})</h3>
                <button className="close-menu-btn" onClick={() => setShowMembersModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <UilTimes size="24" />
                </button>
              </div>

              <div className="members-list-container" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {membersLoading ? (
                  <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--gray)' }}>Loading members...</p>
                ) : (
                  membersList.map((member) => (
                    <div
                      key={member.id}
                      className="member-item"
                      onClick={() => setSelectedMember(member)}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--glass)', cursor: 'pointer' }}
                    >
                      <div className="member-avatar" style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF919D 0%, #fc6777 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem'
                      }}>
                        {member.nickname ? member.nickname.substring(0, 1).toUpperCase() : '?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '500', color: 'var(--black)' }}>
                          {member.nickname || 'Unknown User'}
                          {member.id === groupData.ownerUserId && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#ffe0e3', color: 'var(--pink)', padding: '2px 6px', borderRadius: '4px' }}>Owner</span>}
                          {member.id === userData.uid && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#e0e0e0', color: 'var(--gray)', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>
                          {(() => {
                            const lastActive = (groupData?.memberLastActive && groupData.memberLastActive[member.id]) || member.lastPostDate;
                            if (!lastActive) return t('groupChat.noActivity') || "No recent activity";

                            let dateObj;
                            if (lastActive.toDate) dateObj = lastActive.toDate();
                            else if (lastActive.seconds) dateObj = new Date(lastActive.seconds * 1000);
                            else dateObj = new Date(lastActive);

                            const now = new Date();
                            const diffDays = Math.floor((now - dateObj) / (1000 * 60 * 60 * 24));

                            if (diffDays <= 0) return t('groupChat.activeToday') || "Active today";
                            if (diffDays === 1) return t('groupChat.activeYesterday') || "Active yesterday";
                            if (diffDays < 30) return (t('groupChat.activeDaysAgo') || "Active {days} days ago").replace('{days}', diffDays);
                            const diffMonths = Math.floor(diffDays / 30);
                            return (t('groupChat.activeMonthsAgo') || "Active > {months} months ago").replace('{months}', diffMonths);
                          })()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Unity Percentage Modal */}
      {showUnityModal && (
        <div className="leave-modal-overlay" onClick={() => setShowUnityModal(false)}>
          <div className="leave-modal-content unity-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>
                {unityPercentage === 100 ? '☀️' :
                  unityPercentage >= 66 ? '🌕' :
                    unityPercentage >= 33 ? '🌠' :
                      '🌑'}
              </span>
              <button className="close-menu-btn" onClick={() => setShowUnityModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}>
                <UilTimes size="24" />
              </button>
            </div>

            <div className="unity-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
              <p className="unity-description" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--black)', textAlign: 'center', margin: '1rem 0', lineHeight: '1.4' }}>
                {t('groupChat.unityModalDescription') || "Let's all aim for the Celestial Kingdom together!"}
              </p>

              <div className="unity-percentage-display" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                <div style={{ fontSize: '3.5rem', fontWeight: '800', color: 'var(--pink)', lineHeight: '1' }}>{unityPercentage}%</div>
                <div className="unity-progress-container" style={{ width: '100%', height: '14px', background: 'rgba(0,0,0,0.05)', borderRadius: '7px', overflow: 'hidden', marginTop: '12px' }}>
                  <div className="unity-progress-bar" style={{ width: `${unityPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #FF919D 0%, #fc6777 100%)', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
                </div>

                <div className="unity-legend" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{t('groupChat.unityModalLegendTitle') || "Progress Guide"}</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>☀️</span>
                      <span style={{ color: unityPercentage === 100 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage === 100 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendCelestial') || "Celestial (100%)"}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🌕</span>
                      <span style={{ color: (unityPercentage >= 66 && unityPercentage < 100) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 66 && unityPercentage < 100) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTerrestrial') || "Terrestrial (66%~)"}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🌠</span>
                      <span style={{ color: (unityPercentage >= 33 && unityPercentage < 66) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 33 && unityPercentage < 66) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTelestial') || "Telestial (33%~)"}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🌑</span>
                      <span style={{ color: unityPercentage < 33 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage < 33 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendEmpty') || "Starting (0%~)"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {membersLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner-mini" style={{ margin: '0 auto', width: '30px', height: '30px', border: '3px solid rgba(255,145,157,0.3)', borderTopColor: 'var(--pink)' }}></div>
                  <p style={{ marginTop: '10px', color: 'var(--gray)' }}>Loading members...</p>
                </div>
              ) : (
                <div className="unity-lists" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="unity-list-section">
                    <h4 style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>✅</span> {t('groupChat.unityModalPosted') || "Members who posted notes"}
                    </h4>
                    <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {unityModalData.posted.length > 0 ? (
                        unityModalData.posted.map((member, i) => (
                          <span
                            key={i}
                            className="unity-nickname-chip"
                            onClick={() => handleUserProfileClick(member.id)}
                            style={{
                              background: '#e8f8f0',
                              color: '#27ae60',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              boxShadow: '0 2px 4px rgba(39, 174, 96, 0.1)',
                              cursor: 'pointer'
                            }}
                          >
                            {member.nickname}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--gray)', fontSize: '0.9rem', padding: '5px 0' }}>{t('groupChat.unityModalNoPostsYet') || "No posts yet today"}</span>
                      )}
                    </div>
                  </div>

                  <div className="unity-list-section">
                    <h4 style={{ color: 'var(--pink)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>💪</span> {t('groupChat.unityModalNotPosted') || "Let's encourage those who haven't posted yet!"}
                    </h4>
                    <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {unityModalData.notPosted.length > 0 ? (
                        unityModalData.notPosted.map((member, i) => (
                          <span
                            key={i}
                            className="unity-nickname-chip"
                            onClick={() => handleUserProfileClick(member.id)}
                            style={{
                              background: '#fff0f3',
                              color: 'var(--pink)',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              boxShadow: '0 2px 4px rgba(255, 145, 157, 0.1)',
                              cursor: 'pointer'
                            }}
                          >
                            {member.nickname}
                          </span>
                        ))
                      ) : (
                        <div style={{ background: '#fff9e6', color: '#B8860B', padding: '10px 15px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 'bold', width: '100%', textAlign: 'center', border: '1px solid #ffeeba' }}>
                          ✨ {t('groupChat.unityModalAllPosted') || 'Everyone has posted today! Amazing unity!'} ✨
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="modal-btn primary" onClick={() => setShowUnityModal(false)} style={{ width: '100%', maxWidth: 'none' }}>
                {t('groupChat.welcomeGuideButton') || t('welcomeGuideButton') || "Got it!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedMember && (
        <UserProfileModal
          user={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="leave-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="leave-modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('groupChat.inviteLink')}</h3>
              <button className="close-menu-btn" onClick={() => setShowInviteModal(false)}>
                <UilTimes size="24" />
              </button>
            </div>
            <div className="invite-modal-body">
              <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData} />
              <div className="invite-link-card" onClick={handleCopyInviteLink}>
                <div className="invite-link-content">
                  <span className="invite-link-url">{window.location.origin}/join/{groupData?.inviteCode}</span>
                </div>
                <div className="copy-badge">
                  <UilCopy size="18" />
                  <span>{t('groupChat.inviteLink')}</span>
                </div>
              </div>
              <p className="invite-footer-hint">{t('groupChat.inviteLinkHint')}</p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="send-message-form"
        style={window.innerWidth <= 768 && isAnyModalOpen ? { display: 'none' } : {}}
      >
        {replyTo && (
          <div className="reply-preview">
            <div className="reply-info">
              <span className="replying-to">{t('groupChat.replyingTo')} <strong>{replyTo.senderNickname}</strong></span>
              <p className="reply-text-preview">
                {replyTo.isNote || replyTo.isEntry
                  ? t('groupChat.studyNote')
                  : (replyTo.text ? (replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '')) : 'Image/Note')
                }
              </p>
            </div>
            <div className="cancel-reply" onClick={() => setReplyTo(null)}>
              <UilTimes size="16" />
            </div>
          </div>
        )}
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              onInputFocusChange && onInputFocusChange(true);
              // Scroll to bottom when keyboard appears on mobile
              if (containerRef.current && window.innerWidth <= 768) {
                setTimeout(() => {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }, 300);
              }
            }}
            onBlur={() => onInputFocusChange && onInputFocusChange(false)}
            placeholder={inputPlaceholder}
            rows={1}
          />
          <div className="add-entry-btn-wrapper">
            {showAddNoteTooltip && (
              <div className="add-note-tooltip" onClick={(e) => { e.stopPropagation(); handleDismissTooltip(); }}>
                <div className="tooltip-content">
                  {t('groupChat.addNoteTooltip')}
                </div>
                <div className="tooltip-arrow"></div>
              </div>
            )}
            <div className="add-entry-btn" onClick={() => { setIsNewNoteOpen(true); handleDismissTooltip(); }}>
              <UilPlus />
            </div>
          </div>
          <button type="submit">{t('groupChat.send')}</button>
        </div>
      </form>
    </div >
  );
};

export default GroupChat; 