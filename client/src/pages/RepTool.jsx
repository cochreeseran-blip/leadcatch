import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom icons for knock pins
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const OUTCOMES = [
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'has_contractor', label: 'Has Contractor' },
  { value: 'not_available', label: 'Not Available Right Now' },
  { value: 'inspection_set', label: 'Inspection Set' },
  { value: 'other', label: 'Other' },
];

function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 18);
    }
  }, [position, map]);
  return null;
}

export default function RepTool() {
  const { user, logout } = useAuth();
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [stats, setStats] = useState({ knocks_today: 0, leads_today: 0 });
  const [flash, setFlash] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [form, setForm] = useState({ homeownerName: '', phone: '', outcome: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [knocks, setKnocks] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const panelRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    fetchStats();
    fetchTodayKnocks();
    startLocationWatch();
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  async function fetchStats() {
    try {
      const data = await api('/api/knocktrakr/stats');
      setStats(data);
    } catch {}
  }

  async function fetchTodayKnocks() {
    try {
      const data = await api('/api/knocktrakr/knocks');
      setKnocks(data || []);
    } catch {}
  }

  function startLocationWatch() {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(acc));
      },
      (err) => console.log('GPS watch error:', err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  async function detectLocation() {
    setLocating(true);
    setShowSearch(false);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setUserPos({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(acc));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'KnockTrakr/1.0 (useleadcatch.com)' } }
          );
          const data = await res.json();
          const addr = data.address;
          const full = `${addr.house_number || ''} ${addr.road || ''}, ${addr.city || addr.town || ''}, ${addr.state || ''}`.trim();
          setAddress(full || data.display_name || '');
          setSearchQuery(full || data.display_name || '');
          setShowSearch(true);
        } catch {
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setSearchQuery(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setShowSearch(true);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Could not get location. Please enable location access.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function searchAddress() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'KnockTrakr/1.0' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const result = data[0];
        setLat(parseFloat(result.lat));
        setLng(parseFloat(result.lon));
        setAddress(result.display_name);
        setAccuracy(null);
        setShowFlash('Address confirmed!', 'green');
      } else {
        alert('Address not found. Please try a different search.');
      }
    } catch (err) {
      alert('Failed to search address. Please try again.');
    } finally {
      setSearching(false);
    }
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
      await fetchTodayKnocks();
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
      await fetchTodayKnocks();
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

      <div className="flex-1 flex flex-col px-4 pt-4 pb-32 gap-3 overflow-y-auto">
        {/* Map Container */}
        <div className="w-full rounded-xl overflow-hidden border border-stone-300" style={{ height: '45vh', minHeight: '300px' }}>
          <MapContainer
            center={userPos || { lat: 39.8283, lng: -98.5795 }}
            zoom={userPos ? 18 : 4}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {userPos && (
              <>
                <Circle
                  center={[userPos.lat, userPos.lng]}
                  radius={accuracy || 10}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 }}
                />
                <Marker position={[userPos.lat, userPos.lng]}>
                  <Popup>You are here</Popup>
                </Marker>
                <MapCenter position={[userPos.lat, userPos.lng]} />
              </>
            )}
            {knocks.map((knock, idx) => (
              knock.lat && knock.lng && (
                <Marker
                  key={idx}
                  position={[knock.lat, knock.lng]}
                  icon={knock.outcome === 'no_answer' ? greyIcon : greenIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-medium">{knock.address}</p>
                      <p className="text-stone-500">{knock.outcome === 'no_answer' ? 'No Answer' : 'Answered'}</p>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>

        <button
          onClick={detectLocation}
          disabled={locating}
          className="w-full py-3 rounded-xl text-white font-semibold text-base transition active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: '#1c1917', minHeight: '56px', fontSize: '16px' }}
        >
          {locating ? 'Detecting...' : '📍 Detect My Location'}
        </button>

        {accuracy !== null && (
          <div className={`text-sm px-3 py-2 rounded-lg ${accuracy > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
            {accuracy > 50 ? (
              <span>⚠️ Low GPS accuracy (±{accuracy} meters) — consider searching manually</span>
            ) : (
              <span>📍 Location detected (±{accuracy} meters)</span>
            )}
          </div>
        )}

        {showSearch && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
            <label className="text-sm text-stone-600 font-medium">Verify or correct address:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search address..."
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-stone-800 outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={searchAddress}
                disabled={searching}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white font-medium text-sm active:bg-orange-700 disabled:opacity-60"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-stone-500">Edit the address above and click Search to confirm exact location</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustStreetNumber(-1)}
            className="w-12 h-12 rounded-xl bg-stone-200 text-stone-700 text-xl font-bold flex items-center justify-center active:bg-stone-300 flex-shrink-0"
            style={{ minHeight: '48px' }}
          >
            −
          </button>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Address (or detect location above)"
            className="flex-1 border border-stone-300 rounded-xl px-4 py-2 text-stone-800 outline-none focus:border-orange-500 transition"
            style={{ fontSize: '16px', minHeight: '48px' }}
          />
          <button
            onClick={() => adjustStreetNumber(1)}
            className="w-12 h-12 rounded-xl bg-stone-200 text-stone-700 text-xl font-bold flex items-center justify-center active:bg-stone-300 flex-shrink-0"
            style={{ minHeight: '48px' }}
          >
            +
          </button>
        </div>

        <div className="flex gap-3 mt-1">
          <button
            onClick={handleNoAnswer}
            disabled={!address}
            className="flex-1 py-4 rounded-xl text-white font-bold text-lg transition active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: '#9ca3af', minHeight: '64px', fontSize: '18px' }}
          >
            NO ANSWER
          </button>
          <button
            onClick={handleAnswered}
            disabled={!address}
            className="flex-1 py-4 rounded-xl text-white font-bold text-lg transition active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: '#ea580c', minHeight: '64px', fontSize: '18px' }}
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
