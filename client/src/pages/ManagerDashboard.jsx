import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const OUTCOME_COLORS = {
  inspection_set: 'bg-green-100 text-green-800',
  not_available: 'bg-yellow-100 text-yellow-800',
  not_interested: 'bg-red-100 text-red-800',
  has_contractor: 'bg-stone-200 text-stone-700',
  no_answer: 'bg-stone-100 text-stone-500',
  other: 'bg-blue-100 text-blue-800',
};

const OUTCOME_LABELS = {
  inspection_set: 'Inspection Set',
  not_available: 'Not Available',
  not_interested: 'Not Interested',
  has_contractor: 'Has Contractor',
  no_answer: 'No Answer',
  other: 'Other',
};

function getDateRange(range) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (range === 'today') return { dateFrom: today, dateTo: today };
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
  }
  if (range === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
  }
  return { dateFrom: today, dateTo: today };
}

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState('today');
  const [stats, setStats] = useState(null);
  const [reps, setReps] = useState([]);
  const [expandedRep, setExpandedRep] = useState(null);
  const [repKnocks, setRepKnocks] = useState({});
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRep, setNewRep] = useState({ firstName: '', lastName: '' });
  const [createdCreds, setCreatedCreds] = useState(null);
  const [addingRep, setAddingRep] = useState(false);

  const range = getDateRange(dateRange);

  useEffect(() => {
    fetchStats();
    fetchReps();
  }, [dateRange]);

  async function fetchStats() {
    try {
      const data = await api(`/api/knocktrakr/manager/stats?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
      setStats(data);
    } catch {}
  }

  async function fetchReps() {
    try {
      const data = await api(`/api/knocktrakr/manager/reps?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
      setReps(data);
    } catch {}
  }

  async function toggleRep(repId) {
    if (expandedRep === repId) {
      setExpandedRep(null);
      return;
    }
    setExpandedRep(repId);
    if (!repKnocks[repId]) {
      try {
        const data = await api(`/api/knocktrakr/manager/reps/${repId}/knocks?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
        setRepKnocks(prev => ({ ...prev, [repId]: data }));
      } catch {}
    }
  }

  async function exportCSV() {
    try {
      const res = await api(`/api/knocktrakr/manager/export?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knocktrakr-${range.dateFrom}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addRep() {
    if (!newRep.firstName || !newRep.lastName) return;
    setAddingRep(true);
    try {
      const username = `${newRep.firstName}_${newRep.lastName}`.toLowerCase().replace(/\s+/g, '');
      const allUsers = await api('/api/users');
      let n = 1;
      while (allUsers.find(u => u.username === `doorknock${n}`)) n++;
      const password = `doorknock${n}`;

      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          role: 'rep',
          companyId: user.companyId,
          firstName: newRep.firstName,
          lastName: newRep.lastName,
          knocktrakrEnabled: true,
        }),
      });

      setCreatedCreds({ username, password });
      setNewRep({ firstName: '', lastName: '' });
      fetchReps();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingRep(false);
    }
  }

  async function removeRep(repId, repName) {
    if (!confirm(`Remove ${repName}? This cannot be undone.`)) return;
    try {
      await api(`/api/users/${repId}`, { method: 'DELETE' });
      fetchReps();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f9fafb' }}>
      <div className="border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold" style={{ color: '#ea580c' }}>KnockTrakr</span>
          <span className="ml-3 text-stone-500 text-sm">Manager Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-stone-600 text-sm">{user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="text-sm text-stone-500 border border-stone-300 rounded-lg px-3 py-1">Logout</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-stone-800">Team Overview</h1>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="px-4 py-2 border border-stone-300 rounded-lg text-stone-700 text-sm font-medium hover:bg-stone-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => { setShowAddRep(true); setCreatedCreds(null); }}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: '#ea580c' }}
            >
              + Add Rep
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Knocks', value: stats?.total_knocks ?? '—' },
            { label: 'Total Leads', value: stats?.total_leads ?? '—' },
            { label: 'Active Reps', value: stats?.active_reps ?? '—' },
            { label: 'Conversion Rate', value: stats ? `${stats.conversion_rate}%` : '—' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="text-3xl font-bold text-stone-800">{card.value}</div>
              <div className="text-stone-500 text-sm mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {['today', 'week', 'month'].map(r => (
            <button
              key={r}
              onClick={() => { setDateRange(r); setRepKnocks({}); setExpandedRep(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={dateRange === r
                ? { backgroundColor: '#ea580c', color: 'white' }
                : { backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db' }
              }
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Rep Name</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Knocks</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Leads</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Conv%</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden md:table-cell">Last Active</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Details</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reps.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-stone-400">No reps found</td></tr>
              )}
              {reps.map(rep => (
                <React.Fragment key={rep.rep_id}>
                  <tr className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-5 py-4 font-medium text-stone-800">{rep.name || rep.username}</td>
                    <td className="px-4 py-4 text-center text-stone-700">{rep.knocks_count}</td>
                    <td className="px-4 py-4 text-center font-semibold" style={{ color: '#ea580c' }}>{rep.leads_count}</td>
                    <td className="px-4 py-4 text-center text-stone-700">{rep.conversion_rate}%</td>
                    <td className="px-4 py-4 text-stone-500 text-sm hidden md:table-cell">
                      {rep.last_active ? new Date(rep.last_active).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => toggleRep(rep.rep_id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {expandedRep === rep.rep_id ? 'Hide' : 'View'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => removeRep(rep.rep_id, rep.name || rep.username)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {expandedRep === rep.rep_id && (
                    <tr>
                      <td colSpan={7} className="bg-stone-50 px-6 py-4">
                        {!repKnocks[rep.rep_id] ? (
                          <div className="text-stone-400 text-sm">Loading...</div>
                        ) : repKnocks[rep.rep_id].length === 0 ? (
                          <div className="text-stone-400 text-sm">No knocks in this period.</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-stone-500">
                                <th className="text-left py-1 pr-4">Address</th>
                                <th className="text-left py-1 pr-4">Time</th>
                                <th className="text-left py-1 pr-4">Outcome</th>
                                <th className="text-left py-1">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {repKnocks[rep.rep_id].map(k => (
                                <tr key={k.id} className="border-t border-stone-200">
                                  <td className="py-2 pr-4 text-stone-700">{k.address || '—'}</td>
                                  <td className="py-2 pr-4 text-stone-500">{new Date(k.created_at).toLocaleTimeString()}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${OUTCOME_COLORS[k.outcome] || 'bg-stone-100 text-stone-600'}`}>
                                      {OUTCOME_LABELS[k.outcome] || k.outcome}
                                    </span>
                                  </td>
                                  <td className="py-2 text-stone-500">{k.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddRep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-800 mb-4">Add Rep</h2>
            {createdCreds ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="text-green-800 font-semibold mb-2">Rep Created Successfully</div>
                  <div className="text-sm font-mono space-y-1">
                    <div><span className="text-stone-500">URL:</span> www.useleadcatch.com/login</div>
                    <div><span className="text-stone-500">Username:</span> {createdCreds.username}</div>
                    <div><span className="text-stone-500">Password:</span> {createdCreds.password}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAddRep(false); setCreatedCreds(null); }}
                  className="w-full py-3 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: '#ea580c' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={newRep.firstName}
                  onChange={e => setNewRep(r => ({ ...r, firstName: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500"
                  style={{ fontSize: '16px' }}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newRep.lastName}
                  onChange={e => setNewRep(r => ({ ...r, lastName: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500"
                  style={{ fontSize: '16px' }}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddRep(false)}
                    className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addRep}
                    disabled={addingRep}
                    className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                    style={{ backgroundColor: '#ea580c' }}
                  >
                    {addingRep ? 'Creating...' : 'Create Rep'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
