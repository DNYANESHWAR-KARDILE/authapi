import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAuthProfile,
  logoutUser as apiLogout,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authentication session on demand by calling GET /api/auth/me
  const checkAuth = useCallback(async () => {
    try {
      const response = await getAuthProfile();
      if (response.data?.user) {
        setUser(response.data.user);
        return response.data.user;
      } else {
        setUser(null);
        removeStoredToken();
        return null;
      }
    } catch {
      // Unauthenticated, expired, or server unavailable
      setUser(null);
      removeStoredToken();
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const token = getStoredToken();

      // In cross-domain deployments (Vercel frontend to Render backend),
      // third-party cookies are blocked by default in modern browsers.
      // If there is no stored token, the visitor is in an expected unauthenticated state.
      // We resolve the logged-out state immediately to avoid firing an unnecessary
      // request to /api/auth/me that generates a 401 console error on initial load.
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await getAuthProfile();
        if (isMounted) {
          if (response.data?.user) {
            setUser(response.data.user);
          } else {
            setUser(null);
            removeStoredToken();
          }
        }
      } catch {
        if (isMounted) {
          // Expected unauthenticated response (e.g. token expired, invalid session)
          removeStoredToken();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (userData, token) => {
    if (token) {
      setStoredToken(token);
    }
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Server logout failure should not block client session clearance
    } finally {
      removeStoredToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        loading,
        checkAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

