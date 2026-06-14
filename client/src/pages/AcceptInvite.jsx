import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AddToHomeScreen from './AddToHomeScreen.jsx';

function Brand() {
  return (
    <div className="text-center mb-8">
      <img src="/icons/wordmark.png" alt="KnockTrakr" style={{ height: '34px', margin: '0 auto' }} />
    </div>
  );
}

const cardClass = 'bg-white rounded-2xl p-8 shadow-2xl';
const cardStyle = { border: '1px solid var(--kt-line)' };
const screenClass = 'min-h-screen flex items-center justify-center px-4';
const screenStyle = { background: 'var(--kt-navy)' };

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [status, setStatus] = useState('loading'); // 'loading' | 'invalid' | 'ready' | 'pwa'
  const [errorMsg, setErrorMsg] = useState('');
  const [repInfo, setRepInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token found in this link. Check the link in your email and try again.');
      setStatus('invalid');
      return;
    }
    api(`/api/auth/invite/${token}`)
      .then(data => { setRepInfo(data); setStatus('ready'); })
      .catch(err => {
        setErrorMsg(err.message || 'This invite link has expired or is invalid. Ask your manager to send a new one.');
        setStatus('invalid');
      });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const data = await api(`/api/auth/invite/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      login(data.token, data.user);
      setStatus('pwa');
    } catch (err) {
      setFormError(err.message || 'Failed to set up account. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className={screenClass} style={screenStyle}>
        <div style={{ color: 'var(--kt-muted-dark)', fontSize: '14px' }}>Checking invite link…</div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className={screenClass} style={screenStyle}>
        <div className="w-full max-w-sm">
          <div className={cardClass} style={cardStyle}>
            <Brand />
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
              <p className="text-red-700 text-sm leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="kt-btn kt-btn-ghost w-full"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pwa') {
    return (
      <AddToHomeScreen
        repName={repInfo?.firstName || ''}
        onSkip={() => navigate('/knocktrakr/rep')}
      />
    );
  }

  return (
    <div className={screenClass} style={screenStyle}>
      <div className="w-full max-w-sm">
        <div className={cardClass} style={cardStyle}>
          <Brand />

          <div className="mb-6">
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--kt-font-display)', color: 'var(--kt-text)' }}>
              Welcome, {repInfo?.firstName}!
            </h2>
            <p className="text-sm" style={{ color: 'var(--kt-muted)' }}>Create a password to finish setting up your account.</p>
          </div>

          <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'var(--kt-mist)', border: '1px solid var(--kt-line)' }}>
            <div className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--kt-muted)', fontWeight: 600 }}>Your username</div>
            <div className="font-mono font-semibold" style={{ color: 'var(--kt-text)' }}>{repInfo?.username}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="kt-input"
              style={{ fontSize: '16px' }}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="kt-input"
              style={{ fontSize: '16px' }}
            />

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="kt-btn kt-btn-primary w-full"
              style={{ minHeight: '48px' }}
            >
              {submitting ? 'Setting up…' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
