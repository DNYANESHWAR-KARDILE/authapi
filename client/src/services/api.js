import axios from 'axios';

/**
 * Centralized API configuration.
 * Reads backend URL from VITE_API_URL with local fallback.
 * Ensures proper '/api' suffix regardless of trailing slash format.
 */
const rawBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '');
export const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

/**
 * Axios instance configured for cross-origin authentication.
 * withCredentials: true ensures HttpOnly cookies are transmitted
 * across origins (e.g. Vercel frontend to Railway backend).
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication API functions
export const signupUser = (data) => api.post('/auth/signup', data);
export const verifyOtpCode = (data) => api.post('/auth/verify-otp', data);
export const resendOtpCode = (data) => api.post('/auth/resend-otp', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getAuthProfile = () => api.get('/auth/me');
export const logoutUser = () => api.post('/auth/logout');

export default api;
