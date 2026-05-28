import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const OUTCOMES = [
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'has_contractor', label: 'Has Contractor' },
  { value: 'not_available', label: 'Not Available Right Now' },
  { value: 'inspection_set', label: 'Inspection Set' },
  { value: 'other', label: 'Other' },
];

export default function RepTool() {
  const { user, logout } = useAuth();
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [stats, setStats] = useState({ knocks_today: 0, leads_today: 0 });
  const [flash, setFlash] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({ homeownerName: '', phone: '', outcome: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const data = await api('/api/knocktrakr/stats');
      setStats(data);
    } catch {}
  }

  async function detectLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.display_name || '';
          setAddress(addr);
        } catch {
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Could not get location. Please enable location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function adjustStreetNumber(delta) {
    setAddress(prev => {
      const match = prev.match(/^(\d+)(.*)/);
      if (match) {
        const newNum = Math.max(0, parseInt(match[1]) + delta);
        return `${newNum}${match[2]}`;
      }
      return prev;
    });
  }

  function showFlash(text, color = 'green') {
    setFlash({ text, color });
    setTimeout(() => setFlash(null), 1500);
  }

  async function handleNoAnswer() {
    if (!address) return;
    try {
      await api('/api/knocktrakr/knock', {
        method: 'POST',
        body: JSON.stringify({ address, lat, lng, outcome: 'no_answer' }),
      });
      showFlash('Logged!', 'green');
      setAddress('');
      setLat(null);
      setLng(null);
      await fetchStats();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleAnswered() {
    setPanelOpen(true);
  }

  async function handleSaveLead() {
    if (!form.homeownerName || !form.outcome) {
      alert('Homeowner name and outcome are required.');
      return;
    }
    setSaving(true);
    try {
      const knockData = await api('/api/knocktrakr/knock', {
        method: 'POST',
        body: JSON.stringify({
          address,
          lat,
          lng,
          outcome: form.outcome,
          notes: form.notes,
          isLead: form.outcome === 'inspection_set',
        }),
      });
      await api('/api/knocktrakr/lead', {
        method: 'POST',
        body: JSON.stringify({
          knockId: knockData.id,
          homeownerName: form.homeownerName,
          phone: form.phone,
          address,
          notes: form.notes,
        }),
      });
      showFlash('Lead Saved!', 'orange');
      setPanelOpen(false);
      setForm({ homeownerName: '', phone: '', outcome: '', notes: '' });
      setAddress('');
      setLat(null);
      setLng(null);
      await fetchStats();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const repName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : '';

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden" style={{ maxWidth: '100vw' }}>
      {flash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: flash.color === 'green' ? 'rgba(22,163,74,0.85)' : 'rgba(234,88,12,0.85)' }}
        >
          <div className="text-white text-4xl font-bold">{flash.text}</div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <span className="text-xl font-bold" style={{ color: '#ea580c' }}>KnockTrakr</span>
        <div className="flex items-center gap-3">
          <span className="text-stone-600 text-sm font-medium">{repName}</span>
          <button
            onClick={logout}
            className="text-sm text-stone-500 border border-stone-300 rounded-lg px-3 py-1 active:bg-stone-100"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 pb-32 gap-4">
        <button
          onClick={detectLocation}
          disabled={locating}
          className="w-full py-4 rounded-xl text-white font-semibold text-base transition active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: '#1c1917', minHeight: '64px', fontSize: '16px' }}
        >
          {locating ? 'Detecting...' : '📍 Detect My Location'}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustStreetNumber(-1)}
            className="w-14 h-14 rounded-xl bg-stone-200 text-stone-700 text-2xl font-bold flex items-center justify-center active:bg-stone-300 flex-shrink-0"
            style={{ minHeight: '56px' }}
          >
            −
          </button>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Address (or detect location above)"
            className="flex-1 border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500 transition"
            style={{ fontSize: '16px', minHeight: '56px' }}
          />
          <button
            onClick={() => adjustStreetNumber(1)}
            className="w-14 h-14 rounded-xl bg-stone-200 text-stone-700 text-2xl font-bold flex items-center justify-center active:bg-stone-300 flex-shrink-0"
            style={{ minHeight: '56px' }}
          >
            +
          </button>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            onClick={handleNoAnswer}
            disabled={!address}
            className="flex-1 py-5 rounded-xl text-white font-bold text-lg transition active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: '#9ca3af', minHeight: '72px', fontSize: '18px' }}
          >
            NO ANSWER
          </button>
          <button
            onClick={handleAnswered}
            disabled={!address}
            className="flex-1 py-5 rounded-xl text-white font-bold text-lg transition active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: '#ea580c', minHeight: '72px', fontSize: '18px' }}
          >
            ANSWERED
          </button>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white px-6 py-4 flex items-center justify-center gap-8"
        style={{ zIndex: 30 }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-stone-800">{stats.knocks_today}</div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">Knocks Today</div>
        </div>
        <div className="w-px h-10 bg-stone-200" />
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: '#ea580c' }}>{stats.leads_today}</div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">Leads Today</div>
        </div>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)}>
          <div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ height: '65vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1.5 rounded-full bg-stone-300" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
              <h2 className="text-xl font-bold text-stone-800 mb-1">Log Answered Door</h2>

              <div>
                <label className="block text-sm text-stone-500 mb-1">Homeowner Name *</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.homeownerName}
                  onChange={e => setForm(f => ({ ...f, homeownerName: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500"
                  style={{ fontSize: '16px', minHeight: '56px' }}
                />
              </div>

              <div>
                <label className="block text-sm text-stone-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500"
                  style={{ fontSize: '16px', minHeight: '56px' }}
                />
              </div>

              <div>
                <label className="block text-sm text-stone-500 mb-1">Outcome *</label>
                <select
                  value={form.outcome}
                  onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500 bg-white"
                  style={{ fontSize: '16px', minHeight: '56px' }}
                >
                  <option value="">Select outcome...</option>
                  {OUTCOMES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-stone-500 mb-1">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Any notes..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 outline-none focus:border-orange-500"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-6 pt-3 border-t border-stone-100">
              <button
                onClick={() => {
                  setPanelOpen(false);
                  setForm({ homeownerName: '', phone: '', outcome: '', notes: '' });
                }}
                className="flex-1 py-4 rounded-xl text-stone-700 font-semibold bg-stone-200 active:bg-stone-300"
                style={{ minHeight: '64px', fontSize: '16px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLead}
                disabled={saving}
                className="flex-1 py-4 rounded-xl text-white font-bold active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#ea580c', minHeight: '64px', fontSize: '16px' }}
              >
                {saving ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
