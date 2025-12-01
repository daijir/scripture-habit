import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import Hero from '../Hero/Hero';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat'; // Import GroupChat
import './Dashboard.css';
import Button from '../Button/Button';
import GalleryImages from '../GalleryImages/GalleryImages';
import NewEntry from '../NewEntry/NewEntry';
import MyEntries from '../MyEntries/MyEntries';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState(0);
  const [groupTotalEntries, setGroupTotalEntries] = useState(0);
  const [personalEntriesCount, setPersonalEntriesCount] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]); // State for recent entries

  {/* Control modal NewEntry*/ }
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Fetch recent 3 entries
  useEffect(() => {
    if (!userData || !userData.groupId) return;

    try {
      const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', userData.uid),
        where('isEntry', '==', true),
        orderBy('createdAt', 'desc'),
        limit(3)
      );

      const unsubscribeRecent = onSnapshot(q, (querySnapshot) => {
        const entries = [];
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() });
        });
        setRecentEntries(entries);
      }, (err) => {
        console.error("Error fetching recent entries:", err);
      });

      return () => unsubscribeRecent();
    } catch (err) {
      console.error("Error setting up recent entries listener:", err);
    }
  }, [userData]);



  useEffect(() => {
    // Listen for group's total entries (messages with isEntry === true)
    let unsubscribeGroupEntries = null;
    if (userData && userData.groupId) {
      try {
        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
        const q = query(messagesRef, where('isEntry', '==', true));
        unsubscribeGroupEntries = onSnapshot(q, (querySnapshot) => {
          setGroupTotalEntries(querySnapshot.size || 0);
        }, (err) => {
          console.error('Error fetching group entries count:', err);
        });
      } catch (err) {
        console.error('Error setting up group entries listener:', err);
      }
    } else {
      setGroupTotalEntries(0);
    }

    return () => {
      if (unsubscribeGroupEntries) unsubscribeGroupEntries();
    };
  }, [userData]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Don't set loading to false here, wait for user data to be fetched
    });

    return () => unsubscribeAuth();
  }, []);

  // Keep a fallback/authoritative count of the current user's entries
  useEffect(() => {
    let unsubscribePersonal = null;
    try {
      if (userData && userData.groupId && userData.uid) {
        const messagesRef = collection(db, 'groups', userData.groupId, 'messages');
        const q = query(messagesRef, where('isEntry', '==', true), where('senderId', '==', userData.uid));
        unsubscribePersonal = onSnapshot(q, (snap) => {
          setPersonalEntriesCount(snap.size || 0);
        }, (err) => {
          console.error('Error fetching personal entries count:', err);
          setPersonalEntriesCount(null);
        });
      } else {
        setPersonalEntriesCount(null);
      }
    } catch (err) {
      console.error('Error setting up personal entries listener:', err);
      setPersonalEntriesCount(null);
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
    return (
      <div className='App Dashboard'>
        <div className='AppGlass welcome'>
          <h1>Welcome, {userData.nickname}!</h1>
          <p>You are not part of any group yet.</p>
          <div className="welcome-buttons">
            <Link to="/group-form">
              <Button className="create-btn">Create a Group</Button>
            </Link>
            <Link to="/join-group">
              <Button className="join-btn">Join a Group</Button>
            </Link>
          </div>
        </div>
      </div>
    );
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
            </div>

            <div className="dashboard-stats">
              <div className="stat-card streak-card">
                <h3>{getDisplayStreak()} days streak!</h3>
                <div className="streak-value">
                  <span className="number">{userData.streakCount || 0}</span>
                  <span className="label">days</span>
                </div>
                <p className="streak-subtext">Keep it up!</p>
              </div>
              {/* Placeholder for other stats */}
              <div className="stat-card">
                <h3>Total Entries</h3>
                <div className="streak-value">
                  <span className="number">{(personalEntriesCount !== null ? personalEntriesCount : (userData.totalEntries || 0))}</span>
                  <span className="label">entries</span>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-header">
                <h3>Recent Entries</h3>
                <Link to="#" className="see-all" onClick={(e) => { e.preventDefault(); setSelectedView(1); }}>See All</Link>
              </div>
              <div className="gallery-container">
                <div className="recent-entries-grid">
                  {recentEntries.length === 0 ? (
                    <p className="no-entries-dashboard">No recent entries.</p>
                  ) : (
                    recentEntries.map((entry) => (
                      <div key={entry.id} className="entry-card dashboard-entry-card">
                        <div className="entry-date">
                          {entry.createdAt?.toDate().toLocaleDateString() || 'Unknown Date'}
                        </div>
                        <div className="entry-content">
                          <ReactMarkdown>
                            {entry.text
                              .replace('📖 **New Study Entry**\n\n', '')
                              .replace(/\n\*\*Scripture:\*\*/g, '\n\n**Scripture:**')}
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
          <MyEntries userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
        )}
        {selectedView === 2 && (
          <GroupChat groupId={userData.groupId} userData={userData} />
        )}
        
        {/* Modal - Available across views */}
        <NewEntry isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} />
      </div>
    </div>
  );
};

export default Dashboard;