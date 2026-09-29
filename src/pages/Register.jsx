import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getReferralPreview } from '../api/client.js';
import { downloadKeyFile, formatKeyFile } from '../crypto/keyFile.js';
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../i18n/index.js';
import { detectBrowserTimezone, getTimezoneList } from '../utils/timezones.js';

function getFriendlyRegisterError(serverError, statusCode) {
  const msg = (serverError || '').toLowerCase();

  if (statusCode === 429) {
    return {
      text: "You\u2019ve made too many attempts. Take a breather and try again in a minute.",
      action: null,
    };
  }

  if (statusCode === 409 || msg.includes('already in use')) {
    return {
      text: 'That username or email is already associated with an account.',
      action: { label: 'Log in to your account', to: '/login' },
    };
  }

  if (msg.includes('password must be at least 8')) {
    return {
      text: 'Your password must be at least 8 characters long.',
      action: null,
    };
  }

  if (statusCode === 400 || msg.includes('required')) {
    return {
      text: 'Please fill in all the required registration fields.',
      action: null,
    };
  }

  if (msg.includes('publickeys')) {
    return {
      text: 'There was a problem generating secure encryption keys. Please refresh and try again.',
      action: null,
    };
  }

  if (statusCode >= 500) {
    return {
      text: 'Our servers are experiencing an issue. Please try again shortly.',
      action: null,
    };
  }

  if (msg.includes('network') || msg.includes('econnrefused')) {
    return {
      text: 'Network error: Cannot connect to the server. Check your connection.',
      action: null,
    };
  }

  return {
    text: serverError || 'An unexpected error occurred. Please try again.',
    action: null,
  };
}

export default function Register() {
  const { t, i18n } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [referralCode, setReferralCode] = useState('');
  const [referralPreview, setReferralPreview] = useState(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    dateOfBirth: '',
    timezone: detectBrowserTimezone(),
    preferredLanguage: i18n.language || 'en',
  });
  const timezoneOptions = useState(getTimezoneList)[0];
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (!ref) return;
    setReferralCode(ref);
    getReferralPreview(ref)
      .then((res) => setReferralPreview(res.data))
      .catch(() => setReferralPreview(null));
  }, [location.search]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keyBackup, setKeyBackup] = useState(null);
  const [keysDownloaded, setKeysDownloaded] = useState(false);

  if (user && !keyBackup) {
    return <Navigate to="/chat" replace />;
  }

  // Dynamic page title
  useEffect(() => {
    document.title = `${t('auth.registerTitle', 'Create your account')} — QuantumChat`;
    return () => { document.title = 'QuantumChat'; };
  }, [t]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.username.trim()) {
      setError({ text: 'Please choose a username.', action: null });
      return;
    }

    if (form.username.trim().length < 3) {
      setError({ text: 'Usernames must be at least 3 characters.', action: null });
      return;
    }

    if (!form.email.trim()) {
      setError({ text: 'Please enter your email address.', action: null });
      return;
    }

    if (!form.password) {
      setError({ text: 'Please enter a password.', action: null });
      return;
    }

    if (form.password.length < 8) {
      setError({ text: 'Passwords must be at least 8 characters.', action: null });
      return;
    }

    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const keys = await register({ ...form, timezone, referralCode });
      setKeyBackup(keys);
    } catch (err) {
      const serverMsg = err.response?.data?.error;
      const status = err.response?.status;
      setError(getFriendlyRegisterError(serverMsg, status));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-container auth-page-topbar">
        <ThemeSwitcher />
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <BrandLogo size={48} />
          </div>
          <div className="auth-brand-name">QuantumChat</div>
          <h1>{t('auth.registerTitle', 'Create your account')}</h1>
        </div>

        <p className="auth-subtitle">
          {t('auth.registerSubtitle', 'An end-to-end X25519 keypair is generated directly on your device. Your private key stays in your local browser cache and is never sent to our servers.')}
        </p>

        {referralPreview && (
          <div className="auth-notice" style={{ textAlign: 'center' }}>
            <strong>
              Invited by {referralPreview.displayName || `@${referralPreview.username}`}
            </strong>
            <p>You're joining QuantumChat through their invite link.</p>
          </div>
        )}

        <div className="auth-field">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            id="register-username"
            aria-label={t('auth.username', 'Username')}
            placeholder={t('auth.username', 'Username')}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            minLength={3}
            maxLength={30}
          />
        </div>

        <div className="auth-field">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <input
            id="register-email"
            aria-label={t('auth.email', 'Email address')}
            type="email"
            placeholder={t('auth.email', 'Email address')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div className="auth-field auth-field-password">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            id="register-password"
            aria-label={t('auth.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('auth.password', 'Password')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
          <button
            type="button"
            className="password-toggle auth-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {form.password && <PasswordStrengthMeter password={form.password} />}

        <div className="auth-field auth-field-optional">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <select
            id="register-language"
            aria-label={t('auth.preferredLanguage', 'Preferred Language')}
            value={form.preferredLanguage}
            onChange={(e) => {
              const newLang = e.target.value;
              setForm({ ...form, preferredLanguage: newLang });
              setAppLanguage(newLang);
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>

        <div className="auth-field auth-field-optional">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <input
            id="register-dob"
            aria-label={t('auth.dateOfBirth', 'Date of birth (optional)')}
            type="date"
            value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
        </div>
        <div className="auth-field-hint">
          <span>Date of birth is optional — friends get a reminder on your birthday.</span>
          {form.dateOfBirth && (
            <button
              type="button"
              className="auth-field-skip"
              onClick={() => setForm({ ...form, dateOfBirth: '' })}
            >
              Skip
            </button>
          )}
        </div>

        <div className="auth-field auth-field-optional">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <select
            id="register-timezone"
            aria-label={t('auth.timezone', 'Timezone')}
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="auth-field-hint">
          <span>Timezone — used to time your birthday reminder correctly. Change it anytime in Settings.</span>
        </div>
        {error && (
          <div className="auth-error" role="alert" aria-live="polite">
            <span>{error.text}</span>
            {error.action && (
              <Link to={error.action.to} className="auth-error-action">
                {error.action.label}
              </Link>
            )}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? t('common.saving', 'Creating account...') : t('auth.createAccount', 'Create account')}
        </button>

        <p>
          {t('auth.haveAccount', 'Already have an account?')} <Link to="/login">{t('auth.signIn', 'Log in')}</Link>
        </p>
      </form>

      {keyBackup && (
        <div className="create-group-overlay">
          <div className="auth-card" style={{ marginTop: '10vh' }}>
            <div className="auth-brand">
              <h2>Backup your encryption keys</h2>
            </div>
            <p className="auth-subtitle" style={{ color: 'var(--red-400)', fontWeight: 500 }}>
              Warning: If you lose these keys, you will lose access to all your messages. 
              They cannot be recovered by the server.
            </p>
            {!keysDownloaded ? (
              <button
                type="button"
                onClick={() => {
                  const content = formatKeyFile({
                    username: keyBackup.user.username,
                    email: keyBackup.user.email,
                    secretKeys: keyBackup.keySet.map((k) => k.secretKey),
                  });
                  downloadKeyFile(content);
                  setKeysDownloaded(true);
                }}
              >
                Download keys.txt
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/chat')}>
                Continue to chat
              </button>
            )}
            {!keysDownloaded && (
              <button
                type="button"
                style={{ backgroundColor: 'transparent', color: 'var(--text-muted)' }}
                onClick={() => navigate('/chat')}
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
