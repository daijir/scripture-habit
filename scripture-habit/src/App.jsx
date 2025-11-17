import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SignupForm from './Components/SignupForm/SignupForm';
import Hero from './Components/Hero/Hero';
import RightSide from './Components/RightSide/RightSide';
import Sidebar from './Components/Sidebar/Sidebar';
import LoginForm from './Components/LoginForm/LoginForm';
import Button from './Components/Button/Button';
import Dashboard from './Components/Dashboard/Dashboard';

const App  = () => {
  return (
    <Routes>
      {/* Home */}
      <Route
        path="/"
        element={
          <div className='App'>          
            <div className="AppGlass welcome">
              <h1>Welcome to Scripture Habit</h1>
              <div className='buttons'>
                <Link to="/login">
                  <Button>Log in</Button>
                </Link>
                <Link to="/signup">
                  <Button>Sign Up</Button>
                </Link>
              </div>
            </div>
          </div>

        }
      />
      {/* Log in page */}
      <Route path="/login" element={<LoginForm />} />
      {/* Signup page */}
      <Route path="/signup" element={<SignupForm />} />
      {/* Dashboard page */}
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
};

export default App;