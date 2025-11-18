import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Hero from '../Hero/Hero';
import RightSide from '../RightSide/RightSide';
import Sidebar from '../Sidebar/Sidebar';
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserData(userSnap.data());
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
          <Link to="/group-form">
            <button className="create-btn">Create a Group</button>
          </Link>
          {/* TODO: Add Join Group button later */}
        </div>
      </div>
    );
  }

  // If user is in a group
  return (
    <div className='App Dashboard'>
      <div className='AppGlass Grid'>
          <Sidebar/>
          <Hero/>
          <RightSide/>
      </div>
    </div>
  );
};

export default Dashboard;