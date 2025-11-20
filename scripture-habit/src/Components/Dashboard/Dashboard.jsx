import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Hero from '../Hero/Hero';
import RightSide from '../RightSide/RightSide';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat'; // Import GroupChat
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState(0);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Don't set loading to false here, wait for user data to be fetched
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            // Include user's UID in the userData state
            setUserData({ uid: user.uid, ...userSnap.data() });
          } else {
            console.log("No such user document!");
            setUserData(null);
          }
        } catch (e) {
          console.error("Error fetching user data:", e);
          setError("Failed to load user data.");
        } finally {
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    };

    fetchUserData();
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
            <button className="create-btn">Create a Group</button>
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
              <button className="create-btn">Create a Group</button>
            </Link>
            <Link to="/join-group">
              <button className="join-btn">Join a Group</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If user is in a group, render the chat interface
  return (
    <div className='App Dashboard'>
      <div className='AppGlass Grid'>
        <Sidebar selected={selectedView} setSelected={setSelectedView} />
        {selectedView === 0 && (
          <div className="DashboardContent">
            <h1>Dashboard Overview</h1>
            <p>Welcome back, {userData.nickname}!</p>
            {/* Add dashboard widgets here later */}
          </div>
        )}
        {selectedView === 1 && (
          <div className="DashboardContent">
            <h1>Scriptures</h1>
            <p>Scripture study features coming soon...</p>
          </div>
        )}
        {selectedView === 2 && (
          <GroupChat groupId={userData.groupId} userData={userData} />
        )}
        <RightSide />
      </div>
    </div>
  );
};

export default Dashboard;