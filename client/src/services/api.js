import axios from 'axios';

/**
 * Axios instance configured for our Express backend.
 * withCredentials: true ensures that HttpOnly cookies (containing JWT)
 * are automatically sent with every cross-origin request.
 */
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
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
