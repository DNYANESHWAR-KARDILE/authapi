import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Signin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUnverified, setIsUnverified] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setIsUnverified(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUnverified(false);

    const { email, password } = formData;

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await loginUser({
        email: email.trim(),
        password,
      });

      // Update global auth context
      if (res.data?.user) {
        setUser(res.data.user);
      }

      // Navigate to protected home dashboard
      navigate('/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.message || 'Failed to sign in. Please check your credentials.';
      setError(msg);

      // If backend reports email is unverified, show verify option
      if (err.response?.status === 403 && data?.unverified) {
        setIsUnverified(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account to continue</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {isUnverified && (
          <div className="alert alert-warning">
            Your email is not verified yet.{' '}
            <button
              type="button"
              className="btn-alert-action"
              onClick={() =>
                navigate('/verify-otp', { state: { email: formData.email.trim() } })
              }
            >
              Verify OTP Now
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="signin-email">Email Address</label>
            <input
              id="signin-email"
              type="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signin-password">Password</label>
            <div className="password-wrapper">
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="btn-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="btn-content">
                <span className="spinner-inline"></span> Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account yet? <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
};

export default Signin;
