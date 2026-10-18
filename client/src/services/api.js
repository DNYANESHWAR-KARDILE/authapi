
import axios from 'axios';

const TOKEN_KEY = 'auth_token';

/**
 * JWT Token Storage Helpers
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
    // Ignore localStorage restrictions
  }
};

export const removeStoredToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore localStorage restrictions
  }
};

/**
 * API Base URL Resolver
 *
 * VITE_API_URL should contain the backend URL.
 * Example: https://your-backend.onrender.com
 */
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  let raw =
    typeof envUrl === 'string' && envUrl.trim()
      ? envUrl.trim()
      : '';

  if (!raw) {
    raw = 'https://authapi-j30c.onrender.com';
  }

  // Remove trailing slashes
  raw = raw.replace(/\/+$/, '');

  // Remove accidental /api/auth or /auth suffix
  raw = raw
    .replace(/\/api\/auth$/i, '')
    .replace(/\/auth$/i, '');

  // Add /api only once
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

export const API_BASE_URL = resolveBaseUrl();

/**
 * Axios Instance
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * Attach JWT Bearer token when available.
 */
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor
 * Remove invalid token on 401 responses.
 *
 * Do not automatically redirect here.
 * Login/signup/OTP endpoints may also return 401.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login') &&
      !error.config?.url?.includes('/auth/signup') &&
      !error.config?.url?.includes('/auth/verify-otp') &&
      !error.config?.url?.includes('/auth/resend-otp')
    ) {
      removeStoredToken();
    }

    return Promise.reject(error);
  }
);

/**
 * Authentication APIs
 */

// Register user
export const signupUser = (data) =>
  api.post('/auth/signup', data);

// Verify OTP
export const verifyOtpCode = (data) =>
  api.post('/auth/verify-otp', data);

// Resend OTP
export const resendOtpCode = (data) =>
  api.post('/auth/resend-otp', data);

// Login user
export const loginUser = (data) =>
  api.post('/auth/login', data);

// Get logged-in user's profile
export const getAuthProfile = () =>
  api.get('/auth/me');

// Logout user
export const logoutUser = async () => {
  try {
    return await api.post('/auth/logout');
  } finally {
    removeStoredToken();
  }
};

export default api;
