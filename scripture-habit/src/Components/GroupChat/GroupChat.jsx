import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { db, auth } from '../../firebase';
import { UilPlus, UilSignOutAlt, UilCopy, UilTrashAlt, UilTimes, UilArrowLeft, UilPlusCircle, UilUsersAlt } from '@iconscout/react-unicons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, where, getDocs, increment, setDoc, getDoc } from 'firebase/firestore';
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

const GroupChat = ({ groupId, userData, userGroups, isActive = false, onInputFocusChange, onBack, onGroupSelect }) => {
  const { language, t } = useLanguage();
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
  const longPressTimer = useRef(null);
  const containerRef = useRef(null);

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

  const handleDismissInactivityBanner = () => {
    setShowInactivityPolicyBanner(false);
    localStorage.setItem('hasDismissedInactivityPolicy', 'true');
  };

  const handleDismissWelcomeGuide = () => {
    setShowWelcomeGuide(false);
  };
  const textareaRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentGroupIdRef = useRef(groupId);
  const scrollDebounceRef = useRef(null);


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
    prevMessageCountRef.current = 0;

    const groupRef = doc(db, 'groups', groupId);
    const unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        // Include groupId with the data so we can validate it later
        setGroupData({ ...docSnap.data(), _groupId: groupId });
      }
    });

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt'));

    const unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("Error fetching messages:", err);
        setError("Failed to load messages.");
      }
      setLoading(false);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMessages();
    };
  }, [groupId]);

  const inputPlaceholder = useMemo(() => {
    const placeholders = [
      t('groupChat.typeMessage'),
      t('groupChat.placeholderShare'),
      t('groupChat.placeholderInactivity'),
      t('groupChat.placeholderEncourage')
    ];
    return placeholders[Math.floor(Math.random() * placeholders.length)];
  }, [t, groupId]); // Re-roll when group or language changes

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

  // Handle new messages - scroll to bottom
  useEffect(() => {
    if (initialScrollDone && messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, initialScrollDone]);

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

  const handleScroll = () => {
    // Do not save scroll position if we are still initializing
    if (!initialScrollDone) return;

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

      const response = await fetch('/api/leave-group', {
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

      const response = await fetch('/api/delete-group', {
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
      const response = await fetch('/api/generate-weekly-recap', {
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

      // If this is a note with originalNoteId, also delete the personal note
      if ((messageToDelete.isNote || messageToDelete.isEntry) && messageToDelete.originalNoteId) {
        try {
          const noteRef = doc(db, 'users', userData.uid, 'notes', messageToDelete.originalNoteId);
          await deleteDoc(noteRef);
        } catch (err) {
          console.log("Could not delete personal note:", err);
        }
      }

      await deleteDoc(messageRef);

      // Decrement message count
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        messageCount: increment(-1)
      });

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
      } else {
        // Add reaction
        await updateDoc(messageRef, {
          reactions: arrayUnion({
            odU: userData.uid,
            nickname: userData.nickname,
            emoji: '👍'
          })
        });
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

  const handleCopyInviteCode = () => {
    if (groupData && groupData.inviteCode) {
      navigator.clipboard.writeText(groupData.inviteCode);
      toast.success("Invite code copied to clipboard!");
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

  const isAnyModalOpen = showLeaveModal || showDeleteModal || showDeleteMessageModal || editingMessage || showReactionsModal || isNewNoteOpen || noteToEdit;

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
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            {groupData ? groupData.name : t('groupChat.groupName')}
            {groupData?.members && <span className="member-count-badge">({groupData.members.length})</span>}
            {groupData && (
              <span className="unity-score-badge" style={{
                marginLeft: '8px',
                fontSize: '1.0rem',
                display: 'flex',
                alignItems: 'center',
                color: unityPercentage === 100 ? '#B8860B' : 'var(--text-color)',
                fontWeight: unityPercentage === 100 ? 'bold' : 'normal',
                textShadow: unityPercentage === 100 ? '0 0 8px rgba(255, 215, 0, 0.4)' : 'none',
                transition: 'all 0.3s ease'
              }} title="Unity Score: members active today">
                {unityPercentage === 100 ? '🌕' :
                  unityPercentage >= 75 ? '🌔' :
                    unityPercentage >= 50 ? '🌓' :
                      unityPercentage >= 25 ? '🌒' :
                        '🌑'} {unityPercentage}%
              </span>
            )}

          </h2>
        </div>
        {groupData && (
          <>
            {/* Desktop header - hidden on mobile */}
            <div className="header-right desktop-only">
              {userData.uid === groupData.ownerUserId && (
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
              <div className="invite-code-display" onClick={handleCopyInviteCode} title="Copy Invite Code">
                <span>{t('groupChat.inviteCode')}: <strong>{groupData.inviteCode}</strong></span>
                <UilCopy size="16" className="copy-icon" />
              </div>

              <div className="invite-code-display members-btn-desktop" onClick={handleShowMembers} title={t('groupChat.members')}>
                <UilUsersAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>

              {userData.uid === groupData.ownerUserId && (
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

              {userData.uid === groupData.ownerUserId ? (
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
            <button
              className="hamburger-btn mobile-only"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Menu"
            >
              <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
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
              {/* Invite Code Section */}
              <div className="mobile-menu-item invite-section" onClick={() => { handleCopyInviteCode(); setShowMobileMenu(false); }}>
                <div className="menu-item-icon">
                  <UilCopy size="20" />
                </div>
                <div className="menu-item-content">
                  <span className="menu-item-label">{t('groupChat.inviteCode')}</span>
                  <span className="menu-item-value">{groupData.inviteCode}</span>
                </div>
              </div>

              {/* Public/Private Toggle (Owner only) */}
              {userData.uid === groupData.ownerUserId && (
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
              {userData.uid === groupData.ownerUserId && (
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
              {userData.uid === groupData.ownerUserId ? (
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

                    if (percentage === 100) return '🌕';
                    if (percentage >= 75) return '🌔';
                    if (percentage >= 50) return '🌓';
                    if (percentage >= 25) return '🌒';
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
                <img src="/images/welcome-bird.png" alt="Welcome Bird" className="guide-bird-image" />
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
                <div id={`message-${msg.id}`} className="message system-message">
                  <div className="message-content">
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
                    <span className="sender-name">{msg.senderNickname}{msg.isEdited && <span className="edited-indicator"> ({t('groupChat.messageEdited')})</span>}</span>
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
                  <div key={idx} className="reaction-user">
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
                    <div key={member.id} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--glass)' }}>
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
                            const lastActive = member.lastPostDate;
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
          <div className="add-entry-btn" onClick={() => setIsNewNoteOpen(true)}>
            <UilPlus />
          </div>
          <button type="submit">{t('groupChat.send')}</button>
        </div>
      </form>
    </div >
  );
};

export default GroupChat; 