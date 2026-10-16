import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component:
 * Guards private pages from unauthenticated access.
 * While verifying session with backend, displays a loading indicator.
 * If user is not logged in, redirects to the Sign In page.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <div className="spinner"></div>
          <p className="loading-text">Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return children;
};

export default ProtectedRoute;
