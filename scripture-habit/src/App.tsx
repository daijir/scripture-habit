import { Routes, Route, Link } from 'react-router-dom';
import SignupForm from './components/SignupForm';

function App() {
  return (
    <Routes>
      {/* Home / Dashboard */}
      <Route
        path="/"
        element={
          <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
            <h1>Welcome to Scripture Habit</h1>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Link to="/signup">
                <button>Sign Up</button>
              </Link>
            </div>
          </div>
        }
      />

      {/* Signup page */}
      <Route path="/signup" element={<SignupForm />} />
    </Routes>
  );
}

export default App;

