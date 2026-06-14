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
  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview state ──
  const [dateRange, setDateRange] = useState('today');
  const [stats, setStats] = useState(null);
  const [reps, setReps] = useState([]);
  const [expandedRep, setExpandedRep] = useState(null);
  const [repKnocks, setRepKnocks] = useState({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '' });
  const [inviteResult, setInviteResult] = useState(null); // { username, email, inviteUrl, emailSent }
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState(null); // repId currently being resent
  const [resendResult, setResendResult] = useState({}); // { [repId]: { ok, inviteUrl, emailSent } }

  // ── Neighborhoods state ──
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [allReps, setAllReps] = useState([]);
  const [nhLoading, setNhLoading] = useState(false);
  const [showNhForm, setShowNhForm] = useState(false);
  const [nhForm, setNhForm] = useState({ name: '', address: '' });
  const [editingNh, setEditingNh] = useState(null);
  const [assigningNh, setAssigningNh] = useState(null);
  const [assignSelected, setAssignSelected] = useState([]);
  const [savingNh, setSavingNh] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const range = getDateRange(dateRange);

  useEffect(() => {
    fetchStats();
    fetchReps();
  }, [dateRange]);

  useEffect(() => {
    if (activeTab === 'neighborhoods') {
      fetchNeighborhoods();
      fetchAllReps();
    }
  }, [activeTab]);

  async function fetchStats() {
    try {
      const data = await api(`/api/knocktrakr/manager/stats?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
      setStats(data);
    } catch {}
  }

  async function fetchReps() {
    try {
      const data = await api(`/api/knocktrakr/manager/reps?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
      setReps(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function fetchAllReps() {
    try {
      const data = await api('/api/knocktrakr/manager/reps?dateFrom=2000-01-01&dateTo=2100-01-01');
      setAllReps(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function fetchNeighborhoods() {
    setNhLoading(true);
    try {
      const data = await api('/api/knocktrakr/neighborhoods');
      setNeighborhoods(Array.isArray(data) ? data : []);
    } catch {}
    setNhLoading(false);
  }

  async function toggleRep(repId) {
    if (expandedRep === repId) { setExpandedRep(null); return; }
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
    } catch (err) { alert(err.message); }
  }

  async function inviteRep() {
    if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email) return;
    setInviting(true);
    try {
      const data = await api('/api/knocktrakr/invite-rep', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      setInviteResult(data);
      setInviteForm({ firstName: '', lastName: '', email: '' });
      fetchReps();
    } catch (err) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function resendInvite(repId) {
    setResendingId(repId);
    try {
      const data = await api(`/api/knocktrakr/manager/reps/${repId}/resend-invite`, { method: 'POST' });
      setResendResult(prev => ({ ...prev, [repId]: data }));
    } catch (err) {
      alert(err.message);
    } finally {
      setResendingId(null);
    }
  }

  async function removeRep(repId, repName) {
    if (!confirm(`Remove ${repName}? This cannot be undone.`)) return;
    try {
      await api(`/api/knocktrakr/manager/reps/${repId}`, { method: 'DELETE' });
      fetchReps();
    } catch (err) { alert(err.message); }
  }

  // ── Neighborhood CRUD ──

  function openCreateNh() { setEditingNh(null); setNhForm({ name: '', address: '' }); setShowNhForm(true); }
  function openEditNh(nh) { setEditingNh(nh); setNhForm({ name: nh.name, address: nh.address }); setShowNhForm(true); }

  async function saveNh() {
    if (!nhForm.name || !nhForm.address) return;
    setSavingNh(true);
    try {
      if (editingNh) {
        await api(`/api/knocktrakr/neighborhoods/${editingNh.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: nhForm.name, address: nhForm.address }),
        });
      } else {
        await api('/api/knocktrakr/neighborhoods', {
          method: 'POST',
          body: JSON.stringify({ name: nhForm.name, address: nhForm.address }),
        });
      }
      setShowNhForm(false);
      setEditingNh(null);
      setNhForm({ name: '', address: '' });
      fetchNeighborhoods();
    } catch (err) { alert(err.message); }
    finally { setSavingNh(false); }
  }

  async function deleteNh(nh) {
    if (!confirm(`Delete neighborhood "${nh.name}"? This cannot be undone.`)) return;
    try {
      await api(`/api/knocktrakr/neighborhoods/${nh.id}`, { method: 'DELETE' });
      fetchNeighborhoods();
    } catch (err) { alert(err.message); }
  }

  function openAssign(nh) {
    setAssigningNh(nh);
    setAssignSelected((nh.assigned_reps || []).map(r => r.id));
  }

  function toggleAssignRep(repId) {
    setAssignSelected(prev => prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]);
  }

  async function saveAssignment() {
    if (!assigningNh) return;
    setSavingAssign(true);
    try {
      await api(`/api/knocktrakr/neighborhoods/${assigningNh.id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ repIds: assignSelected }),
      });
      setAssigningNh(null);
      setAssignSelected([]);
      fetchNeighborhoods();
    } catch (err) { alert(err.message); }
    finally { setSavingAssign(false); }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--kt-mist)' }}>
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--kt-line)' }}>
        <div>
          <img src="/icons/wordmark.png" alt="KnockTrakr" style={{ height: '24px' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--kt-muted)' }}>Manager Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-stone-600 text-sm">{user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="text-sm text-stone-500 border border-stone-300 rounded-lg px-3 py-1">Logout</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white border-b border-stone-200 px-6">
        <div className="flex gap-1 max-w-6xl mx-auto">
          {[{ key: 'overview', label: 'Overview' }, { key: 'neighborhoods', label: 'Neighborhoods' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-kt-red text-kt-red'
                  : 'border-transparent text-stone-500 hover:text-stone-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <>
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
                  onClick={() => { setShowInviteForm(true); setInviteResult(null); }}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: 'var(--kt-red)' }}
                >
                  + Invite Rep
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
                    ? { backgroundColor: 'var(--kt-red)', color: 'white' }
                    : { backgroundColor: 'white', color: 'var(--kt-text)', border: '1px solid var(--kt-line)' }
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
                    <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-stone-400">No reps yet — invite your first one above</td></tr>
                  )}
                  {reps.map(rep => (
                    <React.Fragment key={rep.rep_id}>
                      <tr className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-stone-800">{rep.name || rep.username}</span>
                            {rep.invite_pending && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending Setup</span>
                            )}
                          </div>
                          <div className="text-xs text-stone-400">@{rep.username}</div>
                        </td>
                        <td className="px-4 py-4 text-center text-stone-700">{rep.knocks_count}</td>
                        <td className="px-4 py-4 text-center font-semibold" style={{ color: 'var(--kt-red)' }}>{rep.leads_count}</td>
                        <td className="px-4 py-4 text-center text-stone-700">{rep.conversion_rate}%</td>
                        <td className="px-4 py-4 text-stone-500 text-sm hidden md:table-cell">
                          {rep.last_active ? new Date(rep.last_active).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {rep.invite_pending ? (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => resendInvite(rep.rep_id)}
                                  disabled={resendingId === rep.rep_id}
                                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                                >
                                  {resendingId === rep.rep_id ? 'Sending…' : 'Resend Invite'}
                                </button>
                                {resendResult[rep.rep_id] && (
                                  <span className="text-xs text-green-600">
                                    {resendResult[rep.rep_id].emailSent ? 'Sent!' : 'Link generated'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => toggleRep(rep.rep_id)} className="text-sm text-blue-600 hover:underline">
                                {expandedRep === rep.rep_id ? 'Hide' : 'View'}
                              </button>
                            )}
                            <button onClick={() => removeRep(rep.rep_id, rep.name || rep.username)} className="text-sm text-red-500 hover:underline">
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRep === rep.rep_id && !rep.invite_pending && (
                        <tr>
                          <td colSpan={6} className="bg-stone-50 px-6 py-4">
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
          </>
        )}

        {/* ══ NEIGHBORHOODS TAB ══ */}
        {activeTab === 'neighborhoods' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-stone-800">Neighborhoods</h1>
              <button
                onClick={openCreateNh}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                style={{ backgroundColor: 'var(--kt-red)' }}
              >
                + Add Neighborhood
              </button>
            </div>

            {nhLoading ? (
              <div className="text-stone-400 text-center py-16">Loading…</div>
            ) : neighborhoods.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
                <p className="text-stone-400 text-base mb-4">No neighborhoods yet</p>
                <button
                  onClick={openCreateNh}
                  className="px-5 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: 'var(--kt-red)' }}
                >
                  Add your first neighborhood
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {neighborhoods.map(nh => (
                  <div key={nh.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-stone-800 text-base">{nh.name}</h3>
                        <p className="text-stone-500 text-sm mt-0.5 truncate">{nh.address}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(nh.assigned_reps || []).length === 0 ? (
                            <span className="text-xs text-stone-400 italic">No reps assigned</span>
                          ) : (nh.assigned_reps || []).map(r => (
                            <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                              {r.name || r.username}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openAssign(nh)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors">Assign Reps</button>
                        <button onClick={() => openEditNh(nh)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors">Edit</button>
                        <button onClick={() => deleteNh(nh)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Invite Rep modal ── */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-800 mb-4">Invite Rep</h2>

            {inviteResult ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="text-green-800 font-semibold mb-2">
                    {inviteResult.emailSent ? `Invite sent to ${inviteResult.email}` : 'Account created'}
                  </div>
                  <div className="text-sm space-y-1">
                    <div><span className="text-stone-500">Username:</span> <span className="font-mono font-semibold">{inviteResult.username}</span></div>
                    {!inviteResult.emailSent && (
                      <div className="mt-2">
                        <div className="text-stone-500 text-xs mb-1">Email not sent — share this link directly:</div>
                        <div className="bg-stone-100 rounded-lg px-3 py-2 text-xs font-mono break-all text-stone-700">{inviteResult.inviteUrl}</div>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setShowInviteForm(false); setInviteResult(null); }}
                  className="w-full py-3 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: 'var(--kt-red)' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text" placeholder="First Name"
                  value={inviteForm.firstName}
                  onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-kt-navy"
                  style={{ fontSize: '16px' }}
                />
                <input
                  type="text" placeholder="Last Name"
                  value={inviteForm.lastName}
                  onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-kt-navy"
                  style={{ fontSize: '16px' }}
                />
                <input
                  type="email" placeholder="Email address"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-kt-navy"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-stone-400">An invite email will be sent with a link to set up their account.</p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowInviteForm(false)} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
                  <button
                    onClick={inviteRep}
                    disabled={inviting || !inviteForm.firstName || !inviteForm.lastName || !inviteForm.email}
                    className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                    style={{ backgroundColor: 'var(--kt-red)' }}
                  >
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Neighborhood modal ── */}
      {showNhForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-800 mb-4">{editingNh ? 'Edit Neighborhood' : 'Add Neighborhood'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Name *</label>
                <input type="text" placeholder="e.g. Maplewood Estates" value={nhForm.name} onChange={e => setNhForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-kt-navy" style={{ fontSize: '16px' }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Starting Address *</label>
                <input type="text" placeholder="e.g. 123 Maple St, Springfield, IL" value={nhForm.address} onChange={e => setNhForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-kt-navy" style={{ fontSize: '16px' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowNhForm(false); setEditingNh(null); }} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
                <button onClick={saveNh} disabled={savingNh || !nhForm.name || !nhForm.address} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--kt-red)' }}>
                  {savingNh ? 'Saving…' : editingNh ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Reps modal ── */}
      {assigningNh && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-800 mb-1">Assign Reps</h2>
            <p className="text-stone-500 text-sm mb-4">{assigningNh.name}</p>
            {allReps.filter(r => !r.invite_pending).length === 0 ? (
              <p className="text-stone-400 text-sm py-4 text-center">No active reps yet</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
                {allReps.filter(r => !r.invite_pending).map(rep => (
                  <label key={rep.rep_id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={assignSelected.includes(rep.rep_id)} onChange={() => toggleAssignRep(rep.rep_id)} className="w-4 h-4 accent-kt-red" />
                    <span className="text-stone-800 text-sm font-medium">{rep.name || rep.username}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setAssigningNh(null); setAssignSelected([]); }} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
              <button onClick={saveAssignment} disabled={savingAssign} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--kt-red)' }}>
                {savingAssign ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
