import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function makePinIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 28"><path fill="${color}" stroke="rgba(0,0,0,0.18)" stroke-width="0.5" d="M10 1C5.58 1 2 4.58 2 9c0 6.75 8 18 8 18s8-11.25 8-18c0-4.42-3.58-8-8-8z"/><circle fill="white" cx="10" cy="9" r="3.5"/></svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -30],
  });
}

const greyPinIcon = makePinIcon('#9ca3af');
const accentPinIcon = makePinIcon('#E11D3A');

const userDotIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#0A2540;border:2.5px solid white;box-shadow:0 0 0 4px rgba(10,37,64,0.22)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const OUTCOMES = [
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'has_contractor', label: 'Has Contractor' },
  { value: 'not_available', label: 'Not Available' },
  { value: 'inspection_set', label: 'Inspection Set' },
  { value: 'other', label: 'Other' },
];

const OUTCOME_LABELS = {
  no_answer: 'No Answer',
  not_interested: 'Not Interested',
  has_contractor: 'Has Contractor',
  not_available: 'Not Available',
  inspection_set: 'Inspection Set',
  other: 'Other',
};

const OUTCOME_PILL_COLORS = {
  inspection_set: 'bg-emerald-50 text-emerald-700',
  not_interested: 'bg-red-50 text-red-600',
  has_contractor: 'bg-red-50 text-red-600',
  not_available:  'bg-amber-50 text-amber-700',
  no_answer:      'bg-stone-100 text-stone-500',
  other:          'bg-stone-100 text-stone-500',
};

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function OutcomePill({ outcome }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${OUTCOME_PILL_COLORS[outcome] || OUTCOME_PILL_COLORS.other}`}>
      {OUTCOME_LABELS[outcome] || outcome}
    </span>
  );
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17, { animate: true, duration: 0.5 });
  }, [target, map]);
  return null;
}

function FollowDot({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (!pos) return;
    const latlng = L.latLng(pos.lat, pos.lng);
    if (!map.getBounds().contains(latlng)) {
      map.panTo(latlng, { animate: true });
    }
  }, [pos]);
  return null;
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function RepTool() {
  const { user, logout } = useAuth();

  const [userPos, setUserPos] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  const [todayKnocks, setTodayKnocks] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);

  const [logOpen, setLogOpen] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [detailKey, setDetailKey] = useState(null);
  const [neighborhoodsOpen, setNeighborhoodsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ homeownerName: '', phone: '', outcome: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);

  const posWatchRef = useRef(null);
  const mapInitRef = useRef(false);

  useEffect(() => {
    fetchTodayKnocks();
    fetchNeighborhoods();
    startPosWatch();

    function handleVisibility() {
      if (document.hidden) {
        stopPosWatch();
      } else {
        startPosWatch();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPosWatch();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (userPos && !mapInitRef.current) {
      mapInitRef.current = true;
      setMapTarget([userPos.lat, userPos.lng]);
    }
  }, [userPos]);

  function startPosWatch() {
    if (!navigator.geolocation) return;
    if (posWatchRef.current !== null) return;
    posWatchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude, accuracy: Math.round(acc) });
        setAccuracy(Math.round(acc));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }

  function stopPosWatch() {
    if (posWatchRef.current !== null) {
      navigator.geolocation.clearWatch(posWatchRef.current);
      posWatchRef.current = null;
    }
  }

  async function fetchTodayKnocks() {
    try {
      const data = await api('/api/knocktrakr/knocks');
      setTodayKnocks(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function fetchNeighborhoods() {
    try {
      const data = await api('/api/knocktrakr/neighborhoods/mine');
      setNeighborhoods(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function fetchLeaderboard() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await api(`/api/knocktrakr/leaderboard?dateFrom=${today}`);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function detectLocation() {
    if (locating) return;
    setLocating(true);
    setAddress('');

    // Fast path: use the already-known live position
    if (userPos) {
      setLat(userPos.lat);
      setLng(userPos.lng);
      try {
        const data = await api(`/api/knocktrakr/geocode/reverse?lat=${userPos.lat}&lng=${userPos.lng}`);
        setAddress(data.address || `${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}`);
      } catch {
        setAddress(`${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}`);
      }
      setLocating(false);
      return;
    }

    // Fallback: GPS watch hasn't locked yet — one-time getCurrentPosition
    if (!navigator.geolocation) { setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setAccuracy(Math.round(acc));
        setUserPos({ lat: latitude, lng: longitude, accuracy: Math.round(acc) });
        setMapTarget([latitude, longitude]);
        try {
          const data = await api(`/api/knocktrakr/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          setAddress(data.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } catch {
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  function adjustStreetNumber(delta) {
    setAddress(prev => {
      const m = prev.match(/^(\d+)(.*)/);
      return m ? `${Math.max(0, parseInt(m[1]) + delta)}${m[2]}` : prev;
    });
  }

  function showFlash(text) {
    setFlash(text);
    setTimeout(() => setFlash(null), 1400);
  }

  async function handleNoAnswer() {
    if (!address) return;
    try {
      await api('/api/knocktrakr/knock', {
        method: 'POST',
        body: JSON.stringify({ address, lat, lng, outcome: 'no_answer' }),
      });
      showFlash('Logged!');
      resetLog();
      fetchTodayKnocks();
    } catch (err) { alert(err.message); }
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
          address, lat, lng,
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
      showFlash('Saved!');
      resetLog();
      fetchTodayKnocks();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  function resetLog() {
    setLogOpen(false);
    setShowLeadForm(false);
    setAddress('');
    setLat(null);
    setLng(null);
    setAccuracy(null);
    setForm({ homeownerName: '', phone: '', outcome: '', notes: '' });
  }

  const counts = {
    knocks: todayKnocks.length,
    talks: todayKnocks.filter(k => k.outcome !== 'no_answer').length,
    walks: todayKnocks.filter(k => k.outcome !== 'no_answer' && k.outcome !== 'inspection_set').length,
    appointments: todayKnocks.filter(k => k.outcome === 'inspection_set').length,
  };

  const detailItems = {
    knocks: todayKnocks,
    talks: todayKnocks.filter(k => k.outcome !== 'no_answer'),
    walks: todayKnocks.filter(k => k.outcome !== 'no_answer' && k.outcome !== 'inspection_set'),
    appointments: todayKnocks.filter(k => k.outcome === 'inspection_set'),
  };

  const detailLabels = { knocks: 'Knocks', talks: 'Talks', walks: 'Walks', appointments: 'Appointments' };

  const anySheetOpen = logOpen || !!detailKey || neighborhoodsOpen || leaderboardOpen || menuOpen;

  return (
    <div className="fixed inset-0 overflow-hidden bg-stone-100">

      {/* Flash */}
      {flash && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-stone-900/80 backdrop-blur-sm px-8 py-4 rounded-2xl shadow-xl">
            <span className="text-white text-2xl font-bold tracking-wide">{flash}</span>
          </div>
        </div>
      )}

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={userPos ? [userPos.lat, userPos.lng] : [39.8283, -98.5795]}
          zoom={userPos ? 17 : 4}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {mapTarget && <MapFlyTo target={mapTarget} />}
          <FollowDot pos={userPos} />
          {userPos && (
            <>
              <Circle
                center={[userPos.lat, userPos.lng]}
                radius={accuracy || 15}
                pathOptions={{ color: '#0A2540', fillColor: '#0A2540', fillOpacity: 0.10, weight: 1.5 }}
              />
              <Marker position={[userPos.lat, userPos.lng]} icon={userDotIcon} />
            </>
          )}
          {todayKnocks.map((k, i) =>
            k.lat && k.lng ? (
              <Marker
                key={i}
                position={[parseFloat(k.lat), parseFloat(k.lng)]}
                icon={k.outcome === 'no_answer' ? greyPinIcon : accentPinIcon}
              >
                <Popup>
                  <div className="text-xs leading-snug">
                    <p className="font-semibold text-stone-800">{k.address}</p>
                    <p className="text-stone-400 mt-0.5">{OUTCOME_LABELS[k.outcome] || k.outcome}</p>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(229,232,237,0.7)' }}>
        <img src="/icons/wordmark.png" alt="KnockTrakr" style={{ height: '20px' }} />
        <button
          onClick={() => setMenuOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-95 active:bg-stone-100"
          style={{ color: 'var(--kt-navy)' }}
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {/* Menu bottom sheet */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none' }}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl transition-transform duration-300"
        style={{ transform: menuOpen ? 'translateY(0)' : 'translateY(100%)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="sheet-handle" />
        </div>
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={() => { setMenuOpen(false); setLeaderboardOpen(true); fetchLeaderboard(); }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-colors active:bg-stone-50"
            style={{ border: '1px solid var(--kt-line)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(225,29,58,0.09)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--kt-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--kt-ink)' }}>Leaderboard</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--kt-muted)' }}>See where you rank on the team</div>
            </div>
          </button>
          <button
            onClick={() => { setMenuOpen(false); setNeighborhoodsOpen(true); }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-colors active:bg-stone-50"
            style={{ border: '1px solid var(--kt-line)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(10,37,64,0.07)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--kt-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--kt-ink)' }}>Neighborhoods</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--kt-muted)' }}>Jump to an assigned area on the map</div>
            </div>
          </button>
          <button
            onClick={() => { setMenuOpen(false); logout(); }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-colors active:bg-stone-50"
            style={{ border: '1px solid var(--kt-line)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--kt-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--kt-muted)' }}>Log Out</div>
            </div>
          </button>
        </div>
      </div>

      {/* Counter card */}
      <div className="absolute left-4 right-4 z-10 bottom-24">
        <div className="rounded-2xl shadow-lg grid grid-cols-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(229,232,237,0.8)' }}>
          {[
            { key: 'knocks', label: 'Knocks' },
            { key: 'talks', label: 'Talks' },
            { key: 'walks', label: 'Walks' },
            { key: 'appointments', label: 'Appts' },
          ].map(({ key, label }, idx, arr) => (
            <button
              key={key}
              onClick={() => setDetailKey(key)}
              className={[
                'flex flex-col items-center py-3.5 transition-all active:scale-95 active:bg-stone-50',
                idx < arr.length - 1 ? 'border-r border-stone-200/60' : '',
              ].join(' ')}
            >
              <span className="tabular-nums leading-none" style={{ fontFamily: 'var(--kt-font-display)', fontSize: '26px', fontWeight: 700, color: 'var(--kt-ink)', letterSpacing: '-0.02em' }}>{counts[key]}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider mt-1.5" style={{ color: 'var(--kt-muted)' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Log Knock FAB */}
      <div className="absolute left-4 right-4 z-10 bottom-6">
        <button
          onClick={() => setLogOpen(true)}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.97]"
          style={{ minHeight: '56px', background: 'var(--kt-red)', boxShadow: '0 4px 20px rgba(225,29,58,0.35), 0 1px 3px rgba(0,0,0,0.12)' }}
        >
          Log Knock
        </button>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 transition-opacity duration-300"
        style={{ opacity: anySheetOpen ? 1 : 0, pointerEvents: anySheetOpen ? 'auto' : 'none' }}
        onClick={() => { resetLog(); setDetailKey(null); setNeighborhoodsOpen(false); setLeaderboardOpen(false); }}
      />

      {/* ── Log Knock sheet ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: logOpen ? 'translateY(0)' : 'translateY(110%)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="sheet-handle" />
        </div>

        {!showLeadForm ? (
          <div className="px-5 pt-2 pb-10 space-y-3 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            <h2 className="text-lg font-bold text-stone-900">Log Knock</h2>

            <button
              onClick={detectLocation}
              disabled={locating}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold bg-accent active:opacity-80 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
            >
              {locating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  Detecting…
                </>
              ) : '📍 Get My Location'}
            </button>

            {accuracy !== null && (
              <div className={`text-xs px-3 py-2 rounded-lg ${accuracy > 50 ? 'bg-red-50 text-red-700' : accuracy > 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {accuracy > 50 ? `✕ Poor signal ±${accuracy}m` : accuracy > 20 ? `⚠ Low accuracy ±${accuracy}m` : `✓ ±${accuracy}m`}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustStreetNumber(-1)}
                className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 text-xl font-bold flex items-center justify-center active:bg-stone-200 shrink-0"
              >−</button>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Address"
                className="flex-1 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-800 text-sm outline-none focus:border-stone-400 transition-colors"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={() => adjustStreetNumber(1)}
                className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 text-xl font-bold flex items-center justify-center active:bg-stone-200 shrink-0"
              >+</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleNoAnswer}
                disabled={!address}
                className="py-4 rounded-xl bg-stone-100 text-stone-700 font-semibold text-sm transition-all active:scale-[0.97] active:bg-stone-200 disabled:opacity-40"
                style={{ minHeight: '56px' }}
              >No Answer</button>
              <button
                onClick={() => setShowLeadForm(true)}
                disabled={!address}
                className="py-4 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
                style={{ minHeight: '56px', background: 'var(--kt-red)', boxShadow: '0 2px 10px rgba(225,29,58,0.25)' }}
              >Answered ›</button>
            </div>

            <button onClick={resetLog} className="w-full py-2 text-sm text-stone-400 active:text-stone-600 transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="px-5 pt-2 pb-10 space-y-4 overflow-y-auto" style={{ maxHeight: '85vh' }}>
            <button
              onClick={() => setShowLeadForm(false)}
              className="flex items-center gap-1 text-sm font-medium text-stone-500 active:text-stone-700 transition-colors"
            >
              ‹ <span className="text-stone-400 text-xs truncate max-w-[220px]">{address}</span>
            </button>

            <h2 className="text-lg font-bold text-stone-900">Answered Door</h2>

            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Homeowner Name *</label>
              <input
                type="text"
                placeholder="Full name"
                value={form.homeownerName}
                onChange={e => setForm(f => ({ ...f, homeownerName: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-3 text-stone-800 outline-none focus:border-stone-400 transition-colors"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Phone</label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-3 text-stone-800 outline-none focus:border-stone-400 transition-colors"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Outcome *</label>
              <select
                value={form.outcome}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-3 text-stone-800 outline-none focus:border-stone-400 bg-white transition-colors"
                style={{ fontSize: '16px' }}
              >
                <option value="">Select outcome…</option>
                {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Notes</label>
              <textarea
                rows={2}
                placeholder="Optional notes…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-3 text-stone-800 outline-none focus:border-stone-400 transition-colors resize-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            <button
              onClick={handleSaveLead}
              disabled={saving || !form.homeownerName || !form.outcome}
              className="w-full py-4 rounded-xl text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ minHeight: '56px', background: 'var(--kt-red)', boxShadow: '0 2px 10px rgba(225,29,58,0.25)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* ── Counter detail sheet ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: detailKey ? 'translateY(0)' : 'translateY(110%)', maxHeight: '75vh' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="sheet-handle" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h2 className="text-base font-bold text-stone-900">
            Today's {detailKey ? detailLabels[detailKey] : ''}
            <span className="ml-2 text-sm font-normal text-stone-400">
              {detailKey ? detailItems[detailKey].length : 0}
            </span>
          </h2>
          <button
            onClick={() => setDetailKey(null)}
            className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 active:bg-stone-200 transition-colors"
          >✕</button>
        </div>
        <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(75vh - 90px)' }}>
          {detailKey && detailItems[detailKey].length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-12">Nothing yet today</p>
          ) : detailKey && detailItems[detailKey].map((knock, i) => (
            <div key={i} className="flex items-start justify-between py-3 border-b border-stone-100 last:border-0 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 leading-snug truncate">{knock.address}</p>
                <p className="text-xs text-stone-400 mt-0.5">{fmtTime(knock.created_at)}</p>
              </div>
              <OutcomePill outcome={knock.outcome} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Neighborhoods sheet ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: neighborhoodsOpen ? 'translateY(0)' : 'translateY(110%)', maxHeight: '75vh' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="sheet-handle" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h2 className="text-base font-bold text-stone-900">
            My Neighborhoods
            <span className="ml-2 text-sm font-normal text-stone-400">{neighborhoods.length}</span>
          </h2>
          <button
            onClick={() => setNeighborhoodsOpen(false)}
            className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 active:bg-stone-200 transition-colors"
          >✕</button>
        </div>
        <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(75vh - 90px)' }}>
          {neighborhoods.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--kt-mist)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--kt-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--kt-ink)' }}>No areas assigned yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--kt-muted)' }}>Your manager hasn't assigned a neighborhood — check back soon.</p>
            </div>
          ) : neighborhoods.map(n => (
            <div key={n.id} className="flex items-start justify-between py-4 border-b border-stone-100 last:border-0 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 leading-snug">{n.name}</p>
                <p className="text-xs text-stone-500 mt-0.5 truncate">{n.address}</p>
              </div>
              <a
                href={mapsUrl(n.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-accent active:opacity-80 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                Navigate
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── Leaderboard sheet ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: leaderboardOpen ? 'translateY(0)' : 'translateY(110%)', maxHeight: '80vh' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="sheet-handle" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--kt-font-display)', color: 'var(--kt-ink)' }}>
            Today's Leaderboard
          </h2>
          <button
            onClick={() => setLeaderboardOpen(false)}
            className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 active:bg-stone-200"
          >✕</button>
        </div>
        <div className="overflow-y-auto px-4 pb-10 pt-2" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--kt-mist)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--kt-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--kt-ink)' }}>No knocks logged yet today</p>
              <p className="text-xs mt-1" style={{ color: 'var(--kt-muted)' }}>Get out there — first knock of the day wins the board.</p>
            </div>
          ) : leaderboard.map((rep, i) => {
            const medal = ['🥇', '🥈', '🥉'][i];
            return (
              <div
                key={rep.rep_id}
                className="flex items-center gap-4 py-3 border-b border-stone-100 last:border-0"
                style={rep.is_me ? { background: 'rgba(225,29,58,0.04)', borderRadius: '10px', padding: '10px 8px', margin: '2px -8px' } : {}}
              >
                <div className="text-xl w-7 text-center flex-shrink-0">
                  {medal ?? <span className="text-sm font-bold" style={{ color: 'var(--kt-muted)' }}>#{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: 'var(--kt-ink)' }}>
                    {rep.name || rep.username}
                    {rep.is_me && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--kt-muted)' }}>you</span>}
                  </div>
                </div>
                <div className="flex gap-4 text-center flex-shrink-0">
                  <div>
                    <div className="text-base font-bold" style={{ color: 'var(--kt-ink)' }}>{rep.knocks_count}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--kt-muted)' }}>Knocks</div>
                  </div>
                  <div>
                    <div className="text-base font-bold" style={{ color: 'var(--kt-red)' }}>{rep.leads_count}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--kt-muted)' }}>Leads</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
