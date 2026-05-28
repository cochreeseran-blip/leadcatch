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
    if (user) {
      redirectByRole(user.role);
    }
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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1c1917' }}>
      <div className="w-full max-w-sm mx-4">
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold" style={{ color: '#ea580c' }}>LeadCatch Solutions</div>
            <div className="text-stone-400 mt-2 text-lg">KnockTrakr</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-stone-700 border border-stone-600 text-white rounded-lg px-4 py-3 text-base outline-none focus:border-orange-500 transition"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-stone-700 border border-stone-600 text-white rounded-lg px-4 py-3 text-base outline-none focus:border-orange-500 transition"
                style={{ fontSize: '16px' }}
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-base transition active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: '#ea580c', minHeight: '48px' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
