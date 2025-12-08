import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { db, auth } from '../../firebase';
import { UilPlus, UilSignOutAlt, UilCopy, UilTrashAlt, UilTimes, UilArrowLeft, UilPlusCircle } from '@iconscout/react-unicons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, where, getDocs, increment, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import NewNote from '../NewNote/NewNote';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import LinkPreview from '../LinkPreview/LinkPreview';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext.jsx';

const GroupChat = ({ groupId, userData, userGroups, isActive = false, onInputFocusChange, onBack, onGroupSelect }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
  const longPressTimer = useRef(null);
  const containerRef = useRef(null);
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
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        messageCount: increment(1),
        lastMessageAt: serverTimestamp()
      });

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
      const members = groupData.members || [];

      // 1. Update all members' groupIds
      for (const memberId of members) {
        const userRef = doc(db, 'users', memberId);
        const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', memberId)));

        if (!userSnap.empty) {
          const memberData = userSnap.docs[0].data();
          const updatedGroupIds = (memberData.groupIds || []).filter(id => id !== groupId);

          const updates = { groupIds: updatedGroupIds };
          if (memberData.groupId === groupId) {
            updates.groupId = updatedGroupIds.length > 0 ? updatedGroupIds[0] : null;
          }

          await updateDoc(userRef, updates);
        }
      }

      // 2. Delete the group document (messages subcollection will remain but be orphaned)
      await deleteDoc(doc(db, 'groups', groupId));

      toast.success("Group deleted successfully.");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(`Failed to delete group: ${error.message}`);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {

      if (window.innerWidth > 768) {
        e.preventDefault();
        handleSendMessage();
      }
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
              color: isSent ? 'white' : 'var(--pink)',
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
    const chapterMatch = body.match(/\*\*(?:Chapter|Title|章|タイトル|Capítulo|Título|章節|標題|Chương|Tiêu đề):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = body.match(/\*\*(?:Scripture|聖典|Escritura|經文|Thánh Thư):\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
      const rawChapter = chapterMatch[1].trim();
      const rawScripture = scriptureMatch[1].trim();
      const chapter = translateChapterField(rawChapter, language);
      const scripture = translateScriptureName(rawScripture);

      // Check if scripture is General Conference to use appropriate label
      const gcVariants = ['General Conference', '総大会', 'Conferência Geral', '總會大會', 'Conferencia General', 'Đại Hội Trung Ương', 'การประชุมใหญ่สามัญ', '연차 대회', 'Pangkalahatang Kumperensya', 'Mkutano Mkuu'];
      const isGC = gcVariants.includes(rawScripture);
      const chapterLabel = isGC ? t('noteLabels.talk') : t('noteLabels.chapter');

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

  const isAnyModalOpen = showLeaveModal || showDeleteModal || showDeleteMessageModal || editingMessage || showReactionsModal || isNewNoteOpen || noteToEdit;

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
          <h2>{groupData ? groupData.name : t('groupChat.groupName')}</h2>
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
                {userGroups.map((group) => (
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
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>#</span>
                    </div>
                    <span className="menu-item-label" style={group.id === groupId ? { fontWeight: 'bold' } : {}}>{group.name}</span>
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
                ))}
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
                <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)}>{t('groupChat.cancel')}</button>
                <button className="modal-btn leave" onClick={handleLeaveGroup}>{t('groupChat.confirmLeave')}</button>
              </div>
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
                                <ReactMarkdown>{formatNoteForDisplay(msg.text)}</ReactMarkdown>
                                {(() => {
                                  const chapterMatch = msg.text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
                                  const scriptureMatch = msg.text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
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
                                          style={{
                                            display: 'block',
                                            marginTop: '10px',
                                            fontSize: '0.75rem',
                                            color: msg.senderId === userData?.uid ? 'white' : 'var(--gray)',
                                            textDecoration: 'none',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            width: '100%'
                                          }}
                                        >
                                          {t('dashboard.readInGospelLibrary')}
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
            placeholder={t('groupChat.typeMessage')}
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