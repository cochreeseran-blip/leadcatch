import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [status, setStatus] = useState('loading'); // 'loading' | 'invalid' | 'ready' | 'done'
  const [errorMsg, setErrorMsg] = useState('');
  const [repInfo, setRepInfo] = useState(null); // { firstName, lastName, username }
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneUsername, setDoneUsername] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token found in this link. Check the link in your email and try again.');
      setStatus('invalid');
      return;
    }
    api(`/api/auth/invite/${token}`)
      .then(data => {
        setRepInfo(data);
        setStatus('ready');
      })
      .catch(err => {
        setErrorMsg(err.message || 'This invite link has expired or is invalid. Ask your manager to send a new one.');
        setStatus('invalid');
      });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api(`/api/auth/invite/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      login(data.token, data.user);
      setDoneUsername(data.user.username);
      setStatus('done');
    } catch (err) {
      setFormError(err.message || 'Failed to set up account. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1c1917' }}>
        <div className="text-stone-400 text-sm">Checking invite link…</div>
      </div>
    );
  }

  // ── Invalid / expired ──
  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#1c1917' }}>
        <div className="w-full max-w-sm">
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-3xl font-bold mb-1" style={{ color: '#ea580c' }}>LeadCatch Solutions</div>
            <div className="text-stone-400 mb-8 text-lg">KnockTrakr</div>
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6">
              <p className="text-red-300 text-sm leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-lg text-stone-300 font-medium border border-stone-600 hover:border-stone-500 transition text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done — account created ──
  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#1c1917' }}>
        <div className="w-full max-w-sm">
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-3xl font-bold mb-1" style={{ color: '#ea580c' }}>LeadCatch Solutions</div>
            <div className="text-stone-400 mb-8 text-lg">KnockTrakr</div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
            <h2 className="text-white font-bold text-xl mb-2">Account ready!</h2>
            <p className="text-stone-400 text-sm mb-6">You're all set. Before you continue, save your login info:</p>
            <div className="bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 mb-6 text-left">
              <div className="text-stone-500 text-xs uppercase tracking-wide mb-1">Your username</div>
              <div className="text-white font-mono font-bold text-base">{doneUsername}</div>
              <div className="text-stone-500 text-xs mt-2">Keep this and your password somewhere safe — you'll need them to log in.</div>
            </div>
            <button
              onClick={() => navigate('/knocktrakr/rep')}
              className="w-full py-3 rounded-lg text-white font-semibold text-base transition active:scale-95"
              style={{ backgroundColor: '#ea580c' }}
            >
              Go to KnockTrakr →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready — password form ──
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#1c1917' }}>
      <div className="w-full max-w-sm">
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold" style={{ color: '#ea580c' }}>LeadCatch Solutions</div>
            <div className="text-stone-400 mt-2 text-lg">KnockTrakr</div>
          </div>

          <div className="mb-6">
            <h2 className="text-white font-bold text-xl mb-1">
              Welcome, {repInfo?.firstName}!
            </h2>
            <p className="text-stone-400 text-sm">Create a password to finish setting up your account.</p>
          </div>

          <div className="bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 mb-5">
            <div className="text-stone-500 text-xs uppercase tracking-wide mb-0.5">Your username</div>
            <div className="text-white font-mono font-semibold">{repInfo?.username}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-stone-700 border border-stone-600 text-white rounded-lg px-4 py-3 text-base outline-none focus:border-orange-500 transition"
              style={{ fontSize: '16px' }}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-stone-700 border border-stone-600 text-white rounded-lg px-4 py-3 text-base outline-none focus:border-orange-500 transition"
              style={{ fontSize: '16px' }}
            />

            {formError && (
              <div className="bg-red-900/40 border border-red-700 text-red-400 rounded-lg px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg text-white font-semibold text-base transition active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: '#ea580c', minHeight: '48px' }}
            >
              {submitting ? 'Setting up…' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
