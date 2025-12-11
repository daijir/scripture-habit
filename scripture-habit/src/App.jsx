import { Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react";

import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Button from './Components/Button/Button';
import Dashboard from './Components/Dashboard/Dashboard';
import GroupForm from './Components/GroupForm/GroupForm';
import JoinGroup from './Components/JoinGroup/JoinGroup';
import GroupDetails from "./Components/GroupDetails/GroupDetails";
import GroupOptions from './Components/GroupOptions/GroupOptions';
import Welcome from './Components/Welcome/Welcome';
import { LanguageProvider } from './Context/LanguageContext.jsx';
import ForgotPassword from "./Components/ForgotPassword/ForgotPassword";


const App = () => {

  useEffect(() => {

  }, []);

  return (
    <LanguageProvider>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={<Welcome />}
          />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/group-form" element={<GroupForm />} />
          <Route path="/join-group" element={<JoinGroup />} />

          <Route path="/group-options" element={<GroupOptions />} />
          <Route path="/group/:id" element={<GroupDetails />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
        <Analytics />
      </div>
    </LanguageProvider>
  );
};

export default App;
