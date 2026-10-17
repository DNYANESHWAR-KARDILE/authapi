import axios from 'axios';

const TOKEN_KEY = 'auth_token';

/**
 * Token storage helpers.
 * Manages JWT in localStorage to support cross-origin Bearer token authentication
 * alongside HttpOnly cookies, ensuring reliability across third-party cookie restrictions.
 */
export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Gracefully ignore local storage restrictions (e.g. strict sandboxing)
  }
};

export const removeStoredToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Gracefully ignore
  }
};

/**
 * Centralized API base URL resolver.
 * - Reads VITE_API_URL (configurable for production).
 * - Safe development fallback to localhost:5000 in dev mode.
 * - Safe production fallback to Render backend if unset.
 * - Normalizes trailing slashes and prevents duplicated /api or /auth segments.
 */
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  let raw = (envUrl && typeof envUrl === 'string' && envUrl.trim()) || '';

  if (!raw) {
    raw = import.meta.env.DEV ? 'http://localhost:5000' : 'https://authapi-j30c.onrender.com';
  }

  // Strip trailing slashes
  raw = raw.trim().replace(/\/+$/, '');

  // Prevent accidental duplicated /api/auth or /auth
  raw = raw.replace(/\/api\/auth\/?$/, '').replace(/\/auth\/?$/, '');

  // Ensure clean single /api suffix
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

export const API_BASE_URL = resolveBaseUrl();

/**
 * Axios instance configured for cross-origin authentication.
 * withCredentials: true ensures HttpOnly cookies are transmitted across origins.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if available in storage
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: automatically clear token if 401 Unauthorized occurs on protected call
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid or expired credentials
      removeStoredToken();
    }
    return Promise.reject(error);
  }
);

// Authentication API functions
export const signupUser = (data) => api.post('/auth/signup', data);
export const verifyOtpCode = (data) => api.post('/auth/verify-otp', data);
export const resendOtpCode = (data) => api.post('/auth/resend-otp', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getAuthProfile = () => api.get('/auth/me');
export const logoutUser = () => api.post('/auth/logout');

export default api;

