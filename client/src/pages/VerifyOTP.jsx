import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { verifyOtpCode, resendOtpCode } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // If email was passed from Signup, use it; otherwise allow manual entry
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(60); // 60s cooldown on initial mount if coming from signup

  // Countdown timer for resend OTP cooldown
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleOtpChange = (e) => {
    // Only accept numbers and max 6 digits
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    setError('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      const res = await verifyOtpCode({ email: email.trim(), otp });
      setSuccess(res.data.message || 'Email verified successfully!');

      // Redirect to signin after brief confirmation
      setTimeout(() => {
        navigate('/signin', { state: { email: email.trim() } });
      }, 1500);
    } catch (err) {
      const msg =
        err.response?.data?.message || 'OTP verification failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    if (!email.trim()) {
      setError('Please provide your email address to resend the OTP.');
      return;
    }

    setError('');
    setSuccess('');
    setResending(true);

    try {
      const res = await resendOtpCode({ email: email.trim() });
      setSuccess(res.data.message || 'A fresh OTP has been sent to your email.');
      setCooldown(60); // Reset 60s countdown
      setOtp(''); // Clear previous OTP entry
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Failed to resend OTP. Please try again.';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Verify Your Email</h2>
          <p>We sent a 6-digit verification code to your email</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label htmlFor="otp-email">Email Address</label>
            <input
              id="otp-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="name@example.com"
              disabled={loading || resending}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="otp-input">6-Digit OTP</label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength="6"
              className="otp-input"
              placeholder="••••••"
              value={otp}
              onChange={handleOtpChange}
              disabled={loading}
              autoFocus
              required
            />
            <span className="form-hint">Code expires in 5 minutes</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || otp.length !== 6}
          >
            {loading ? (
              <span className="btn-content">
                <span className="spinner-inline"></span> Verifying Code...
              </span>
            ) : (
              'Verify OTP'
            )}
          </button>
        </form>

        <div className="resend-wrapper">
          <p className="resend-text">Didn't receive the email?</p>
          <button
            type="button"
            className="btn-link"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
          >
            {resending
              ? 'Sending code...'
              : cooldown > 0
              ? `Resend OTP in ${cooldown}s`
              : 'Resend OTP'}
          </button>
        </div>

        <div className="auth-footer">
          Return to <Link to="/signin">Sign In</Link> or <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
