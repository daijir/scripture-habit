import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState(0);
  const [groupTotalNotes, setGroupTotalNotes] = useState(0);
  const [personalNotesCount, setPersonalNotesCount] = useState(null);
  const [recentNotes, setRecentNotes] = useState([]);

  const [isModalOpen, setIsModalOpen] = React.useState(false);

  useEffect(() => {
    if (!userData || !userData.groupId) return;

    try {
      const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', userData.uid),
        where('isNote', '==', true),
        orderBy('createdAt', 'desc'),
        limit(3)
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
  }, [userData]);



  useEffect(() => {
    let unsubscribeGroupNotes = null;
    if (userData && userData.groupId) {
      try {
        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
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
  }, [userData]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribePersonal = null;
    try {
      if (userData && userData.groupId && userData.uid) {
        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
        const q = query(messagesRef, where('isNote', '==', true), where('senderId', '==', userData.uid));
        unsubscribePersonal = onSnapshot(q, (snap) => {
          setPersonalNotesCount(snap.size || 0);
        }, (err) => {
          if (err.code !== 'permission-denied') {
            console.error('Error fetching personal notes count:', err);
          }
          setPersonalNotesCount(null);
        });
      } else {
        setPersonalNotesCount(null);
      }
    } catch (err) {
      console.error('Error setting up personal notes listener:', err);
      setPersonalNotesCount(null);
    }

    return () => {
      if (unsubscribePersonal) unsubscribePersonal();
    };
  }, [userData]);

  useEffect(() => {
    let unsubscribeUser = null;

    const setupUserListener = () => {
      setLoading(true);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData({ uid: user.uid, ...docSnap.data() });
          } else {
            console.log("No such user document!");
            setUserData(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user data:", error);
          setError("Failed to load user data.");
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    };

    setupUserListener();

    return () => {
      if (unsubscribeUser) {
        unsubscribeUser();
      }
    };
  }, [user]);

  if (loading) {
    return <div className='App Dashboard'>Loading dashboard...</div>;
  }

  if (error) {
    return <div className='App Dashboard' style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!user) {
    return <div className='App Dashboard'>Please log in to view the dashboard.</div>;
  }

  // If user is logged in but userData is not fetched or doesn't exist
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

  // If user is logged in and userData exists
  if (!userData.groupId || userData.groupId === "") {
    return <Navigate to="/group-options" replace />;
  }

  const getDisplayStreak = () => {
    try {
      if (!userData) return 0;
      const streak = userData.streakCount || 0;
      if (!userData.lastPostDate) return 0;

      let timeZone = userData.timeZone || 'UTC';
      try {
        // Validate timezone
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
      const chapter = chapterMatch[1].trim();
      const scripture = scriptureMatch[1].trim();

      const chapterEnd = chapterMatch.index + chapterMatch[0].length;
      const scriptureEnd = scriptureMatch.index + scriptureMatch[0].length;

      const maxEnd = Math.max(chapterEnd, scriptureEnd);
      const comment = content.substring(maxEnd).trim();

      return `**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;
    }

    return content;
  };

  // If user is in a group, render the chat interface
  return (
    <div className='App Dashboard'>
      <div className='AppGlass Grid'>
        <Sidebar selected={selectedView} setSelected={setSelectedView} />
        {selectedView === 0 && (
          <div className="DashboardContent">
            <div className="dashboard-header">
              <div>
                <h1>Dashboard Overview</h1>
                <p className="welcome-text">Welcome back, <strong>{userData.nickname}</strong>!</p>
              </div>
              <button className="new-note-btn" onClick={() => setIsModalOpen(true)}>
                <UilPlus /> New Note
              </button>
            </div>

            <div className="dashboard-stats">
              <div className="stat-card streak-card">
                <h3>Streak</h3>
                <div className="streak-value">
                  <span className="number">{userData.streakCount || 0}</span>
                  <span className="label">days</span>
                </div>
                <p className="streak-subtext">Keep it up!</p>
              </div>
              {/* Placeholder for other stats */}
              <div className="stat-card">
                <h3>Total Notes</h3> {/* Updated Text */}
                <div className="streak-value">
                  <span className="number">{(personalNotesCount !== null ? personalNotesCount : (userData.totalNotes || 0))}</span>
                  <span className="label">notes</span> {/* Updated Text */}
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>Recent Notes</h3> {/* Updated Text */}
                <Link to="#" className="see-all" onClick={(e) => { e.preventDefault(); setSelectedView(1); }}>See All</Link>
              </div>
              <div className="gallery-container">
                <div className="recent-notes-grid">
                  {recentNotes.length === 0 ? (
                    <p className="no-notes-dashboard">No recent notes.</p>
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
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>Recent Scriptures</h3>
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
          <GroupChat groupId={userData.groupId} userData={userData} />
        )}

        {/* Modal - Available across views */}
        <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} />
      </div>
    </div>
  );
};

export default Dashboard;