import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">MERN Auth</div>
        <div className="nav-user">
          <span className="user-badge">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <div className="badge-success-pill">
            <span className="status-dot"></span> Authenticated Session Active
          </div>

          <h1 className="welcome-title">
            Welcome back, <span className="highlight-name">{user?.name}</span>! 👋
          </h1>
          <p className="welcome-subtitle">
            You have successfully signed in using email OTP verification and HttpOnly cookie authentication.
          </p>

          <div className="info-grid">
            <div className="info-box">
              <span className="info-label">Full Name</span>
              <span className="info-value">{user?.name || 'N/A'}</span>
            </div>
            <div className="info-box">
              <span className="info-label">Email Address</span>
              <span className="info-value">{user?.email || 'N/A'}</span>
            </div>
            <div className="info-box">
              <span className="info-label">Email Verification</span>
              <span className="info-value text-green">
                {user?.isEmailVerified ? 'Verified ✓' : 'Unverified ✗'}
              </span>
            </div>
            <div className="info-box">
              <span className="info-label">Storage Security</span>
              <span className="info-value text-indigo">HttpOnly Cookie (JWT)</span>
            </div>
          </div>

          <div className="security-notice">
            <div className="notice-icon">🛡️</div>
            <div className="notice-text">
              <strong>Your Token is Protected:</strong> The JSON Web Token (JWT) is kept safely inside an
              <code>HttpOnly</code> cookie. Client-side JavaScript cannot read or steal your token via XSS attacks.
            </div>
          </div>

          <div className="dashboard-actions">
            <button
              onClick={handleLogout}
              className="btn btn-danger"
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out...' : 'Sign Out of Account'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
