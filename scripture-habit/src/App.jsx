import { Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Button from './Components/Button/Button';
import Dashboard from './Components/Dashboard/Dashboard';
import GroupForm from './Components/GroupForm/GroupForm';
import JoinGroup from './Components/JoinGroup/JoinGroup';
import GroupDetails from "./Components/GroupDetails/GroupDetails";

const App = () => {
  return (
    <div className="App">
      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <div className="AppGlass welcome">
              <h1>Welcome to Scripture Habit</h1>
              <div className="buttons">
                <Link to="/login">
                  <Button>Log in</Button>
                </Link>
                <Link to="/signup">
                  <Button>Sign Up</Button>
                </Link>
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
        <Route path="/group-form" element={<GroupForm />} />
        <Route path="/join-group" element={<JoinGroup />} />
        <Route path="/group/:id" element={<GroupDetails />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default App;
