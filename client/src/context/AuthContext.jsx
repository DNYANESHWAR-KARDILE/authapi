import { createContext, useContext, useState, useEffect } from 'react';
import { getAuthProfile, logoutUser as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authentication session on page refresh by calling GET /api/auth/me
  const checkAuth = async () => {
    try {
      const response = await getAuthProfile();
      if (response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch {
      // Unauthenticated or token expired
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const verifyUser = async () => {
      try {
        const response = await getAuthProfile();
        if (isMounted) {
          if (response.data && response.data.user) {
            setUser(response.data.user);
          } else {
            setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifyUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout failed on server:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
