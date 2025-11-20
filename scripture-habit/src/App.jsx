import { Routes, Route, Link } from 'react-router-dom';
import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Button from './Components/Button/Button';
import Dashboard from './Components/Dashboard/Dashboard';
import GroupForm from './Components/GroupForm/GroupForm';
import JoinGroup from './Components/JoinGroup/JoinGroup';

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
      <Route path="/group-form" element={<GroupForm />} />
      <Route path="/join-group" element={<JoinGroup />} />
    </Routes>
  );
};

export default App;