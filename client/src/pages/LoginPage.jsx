import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) redirectByRole(user.role);
  }, [user]);

  function redirectByRole(role) {
    if (role === 'superadmin') navigate('/admin');
    else if (role === 'manager') navigate('/knocktrakr/manager');
    else navigate('/knocktrakr/rep');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.token, data.user);
      redirectByRole(data.user.role);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--kt-navy)' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl p-10 shadow-2xl" style={{ border: '1px solid var(--kt-line)' }}>

          {/* Brand */}
          <div className="text-center mb-9">
            <img src="/icons/wordmark.png" alt="KnockTrakr" style={{ height: '36px', margin: '0 auto 8px' }} />
            <div style={{ color: 'var(--kt-muted)', fontSize: '14px' }}>Sign in to your account</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="kt-input"
              style={{ fontSize: '16px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="kt-input"
              style={{ fontSize: '16px' }}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="kt-btn kt-btn-primary w-full mt-2"
              style={{ minHeight: '48px', marginTop: '8px' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
